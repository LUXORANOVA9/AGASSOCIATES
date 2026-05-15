'use strict';

const fs = require('fs');
const path = require('path');

const STICKY_MARKER = '<!-- pr-orchestrator-sticky -->';
const DUP_MARKER    = '<!-- pr-orchestrator-dup -->';
const STALE_MARKER  = '<!-- pr-orchestrator-stale -->';
const DASH_MARKER   = '<!-- pr-orchestrator-dashboard -->';
const META_MARKER   = '<!-- pr-orchestrator-meta -->';

const ROOT          = path.resolve(__dirname, '..', '..');
const CONFIG_PATH   = path.join(ROOT, '.github', 'orchestrator.config.json');
const RULES_PATH    = path.join(ROOT, '.github', 'labeler-rules.json');
const INDEX_PATH    = path.join(ROOT, 'docs', 'PR_INDEX.md');
const METRICS_PATH  = path.join(ROOT, 'docs', 'PR_METRICS.csv');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function classify(pr, rules) {
  const hay = `${pr.title || ''}\n${pr.body || ''}`;
  const matched = [];
  for (const { label, pattern } of rules.rules) {
    if (new RegExp(pattern, 'i').test(hay)) matched.push(label);
  }
  const hasCategory = matched.some(l => ['security','code-health','feature','bugfix','tests','performance','docs'].includes(l));
  if (!hasCategory) matched.push(rules.fallback_label);
  return Array.from(new Set(matched));
}

function tier(labels, cfg) {
  const inAuto      = labels.find(l => cfg.risk_tiers.auto.includes(l));
  const inReview    = labels.find(l => cfg.risk_tiers.review_required.includes(l));
  const inSizeGated = labels.find(l => cfg.risk_tiers.size_gated.includes(l));
  if (inReview)    return 'review_required';
  if (inSizeGated) return 'size_gated';
  if (inAuto)      return 'auto';
  return 'auto';
}

function ageDays(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// 3-gram Jaccard over title + filenames -> stable, fast similarity for dedupe.
function ngramSet(s, n = 3) {
  const cleaned = (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const out = new Set();
  for (let i = 0; i + n <= cleaned.length; i++) out.add(cleaned.slice(i, i + n));
  return out;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

async function ensureLabels(github, owner, repo, cfg, core) {
  for (const [name, color] of Object.entries(cfg.managed_labels)) {
    try {
      await github.rest.issues.getLabel({ owner, repo, name });
    } catch (e) {
      if (e.status !== 404) { core.warning(`getLabel ${name}: ${e.message}`); continue; }
      try {
        await github.rest.issues.createLabel({ owner, repo, name, color });
        core.info(`Created label ${name}`);
      } catch (ce) {
        if (ce.status !== 422) core.warning(`createLabel ${name}: ${ce.message}`);
      }
    }
  }
}

async function fetchAllOpenPRs(github, owner, repo) {
  return github.paginate(github.rest.pulls.list, {
    owner, repo, state: 'open', per_page: 100, sort: 'updated', direction: 'desc',
  });
}

async function fetchRecentClosed(github, owner, repo, sinceDays = 14) {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const all = await github.paginate(github.rest.pulls.list, {
    owner, repo, state: 'closed', per_page: 100, sort: 'updated', direction: 'desc',
  });
  return all.filter(p => p.closed_at && p.closed_at >= since);
}

async function getPRDetail(github, owner, repo, number) {
  const { data } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  return data;
}

async function getCIConclusion(github, owner, repo, sha) {
  try {
    const { data: checks } = await github.rest.checks.listForRef({ owner, repo, ref: sha, per_page: 100 });
    const runs = checks.check_runs || [];
    if (runs.some(r => r.status !== 'completed')) return 'pending';
    if (runs.some(r => r.conclusion === 'failure' || r.conclusion === 'cancelled' || r.conclusion === 'timed_out')) return 'failing';
    if (runs.length && runs.every(r => ['success', 'skipped', 'neutral'].includes(r.conclusion))) return 'green';
    const { data: status } = await github.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha });
    if (status.state === 'success') return 'green';
    if (status.state === 'failure') return 'failing';
    if (status.state === 'pending') return 'pending';
    return 'none';
  } catch (e) {
    return 'unknown';
  }
}

async function findStickyComment(github, owner, repo, number, marker) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner, repo, issue_number: number, per_page: 100,
  });
  return comments.find(c => (c.body || '').includes(marker));
}

async function upsertComment(github, owner, repo, number, marker, body) {
  const existing = await findStickyComment(github, owner, repo, number, marker);
  const final = `${marker}\n${body}`;
  if (existing) {
    if ((existing.body || '').trim() === final.trim()) return; // no churn
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: final });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number: number, body: final });
  }
}

async function applyMissingLabels(github, owner, repo, number, current, want) {
  const have = new Set(current.map(l => l.name || l));
  const add  = want.filter(l => !have.has(l));
  if (!add.length) return;
  await github.rest.issues.addLabels({ owner, repo, issue_number: number, labels: add });
}

async function enableAutoMergeGraphQL(github, prNodeId, mergeMethod, core) {
  const mutation = `mutation($id: ID!, $m: PullRequestMergeMethod!) {
    enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: $m}) {
      pullRequest { number autoMergeRequest { enabledAt } }
    }
  }`;
  return github.graphql(mutation, { id: prNodeId, m: mergeMethod });
}

async function autoMerge(github, owner, repo, pr, labelNames, cfg, core) {
  if (pr.draft)                                       return { ok: false, reason: 'draft' };
  if (labelNames.includes('keep-open'))               return { ok: false, reason: 'keep-open label' };
  if (pr.auto_merge)                                  return { ok: true,  reason: 'already enabled' };

  const t = tier(labelNames, cfg);
  if (t === 'review_required') return { ok: false, reason: `tier=review_required (${labelNames.join(',')})` };
  if (t === 'size_gated') {
    const total = (pr.additions || 0) + (pr.deletions || 0);
    if (total > cfg.size_gate_max_changed_lines) {
      return { ok: false, reason: `bugfix changes ${total} lines > gate ${cfg.size_gate_max_changed_lines}` };
    }
  }
  try {
    await enableAutoMergeGraphQL(github, pr.node_id, cfg.auto_merge_method, core);
    return { ok: true, reason: 'enabled' };
  } catch (e) {
    return { ok: false, reason: `graphql: ${(e.message || '').split('\n')[0].slice(0, 120)}` };
  }
}

async function autoRebaseIfBehind(github, owner, repo, pr, labelNames, cfg, core) {
  if (!cfg.auto_rebase_enabled || pr.draft) return null;
  if (labelNames.includes('keep-open')) return null;
  if (pr.base.ref !== 'main') return null;
  try {
    const { data: cmp } = await github.rest.repos.compareCommitsWithBasehead({
      owner, repo, basehead: `${pr.head.sha}...${pr.base.ref}`,
    });
    if (cmp.behind_by > 0) {
      await github.rest.pulls.updateBranch({ owner, repo, pull_number: pr.number });
      return `rebased (was ${cmp.behind_by} commits behind ${pr.base.ref})`;
    }
    return null;
  } catch (e) {
    return `rebase-skip: ${(e.message || '').slice(0, 80)}`;
  }
}

function detectDuplicates(prs, threshold) {
  const sigs = prs.map(p => ({
    pr: p,
    sig: ngramSet(`${p.title} ${(p._files || []).join(' ')}`, 3),
  }));
  const groups = [];
  const seen = new Set();
  for (let i = 0; i < sigs.length; i++) {
    if (seen.has(sigs[i].pr.number)) continue;
    const cluster = [sigs[i].pr];
    seen.add(sigs[i].pr.number);
    for (let j = i + 1; j < sigs.length; j++) {
      if (seen.has(sigs[j].pr.number)) continue;
      if (jaccard(sigs[i].sig, sigs[j].sig) >= threshold) {
        cluster.push(sigs[j].pr);
        seen.add(sigs[j].pr.number);
      }
    }
    if (cluster.length > 1) groups.push(cluster);
  }
  return groups;
}

async function attachFiles(github, owner, repo, pr) {
  try {
    const files = await github.paginate(github.rest.pulls.listFiles, {
      owner, repo, pull_number: pr.number, per_page: 100,
    });
    pr._files = files.map(f => f.filename);
  } catch { pr._files = []; }
}

function rowFor(pr, ci, mergeable, autoMerge) {
  const labels = (pr.labels || []).map(l => l.name).join(', ');
  return `| #${pr.number} | ${escapeMd(pr.title).slice(0, 80)} | @${pr.user.login} | ${labels} | ${pr.base.ref} | ${ageDays(pr.created_at)}d | ${ci} | ${mergeable} | ${autoMerge} |`;
}
function escapeMd(s) { return (s || '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

function renderIndex(repoFull, openRows, mergedRows, closedRows, dupGroups, generatedAt) {
  const head = '| # | Title | Author | Labels | Base | Age | CI | Mergeable | Auto-merge |';
  const sep  = '|---|-------|--------|--------|------|-----|----|-----------|------------|';
  const dup = dupGroups.length
    ? dupGroups.map(g => `- **Cluster:** ${g.map(p => `#${p.number}`).join(', ')} — _${escapeMd(g[0].title).slice(0,80)}_`).join('\n')
    : '_No duplicate clusters detected._';
  return [
    `<!-- generated by .github/workflows/pr-orchestrator.yml -->`,
    `# Pull Request Index — \`${repoFull}\``,
    ``,
    `_Last refresh: ${generatedAt}_`,
    ``,
    `## Open PRs (${openRows.length})`,
    ``,
    head, sep, ...openRows,
    ``,
    `## Likely Duplicate Clusters`,
    ``,
    dup,
    ``,
    `## Recently Merged (last 14 days, ${mergedRows.length})`,
    ``,
    head, sep, ...mergedRows,
    ``,
    `## Recently Closed Without Merge (last 14 days, ${closedRows.length})`,
    ``,
    head, sep, ...closedRows,
    ``,
  ].join('\n');
}

function renderMetricsRow(repoFull, prs, mergedRecent, generatedAt) {
  const draft = prs.filter(p => p.draft).length;
  const stale = prs.filter(p => ageDays(p.updated_at) > 14).length;
  const avgAge = prs.length
    ? Math.round(prs.reduce((s, p) => s + ageDays(p.created_at), 0) / prs.length)
    : 0;
  return `${generatedAt},${repoFull},${prs.length},${draft},${stale},${mergedRecent},${avgAge}`;
}

async function upsertDashboardIssue(github, owner, repo, body, core) {
  const dashLabel = 'pr-dashboard';
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: 'open', labels: dashLabel, per_page: 100,
  });
  const final = `${DASH_MARKER}\n${body}`;
  if (issues.length) {
    const issue = issues[0];
    await github.rest.issues.update({ owner, repo, issue_number: issue.number, body: final });
    core.info(`Updated dashboard issue #${issue.number}`);
    return issue;
  }
  const { data: created } = await github.rest.issues.create({
    owner, repo, title: 'PR Orchestration Dashboard', body: final, labels: [dashLabel],
  });
  core.info(`Created dashboard issue #${created.number}`);
  return created;
}

async function upsertMetaDashboard(github, metaToken, cfg, perRepoSummaries, core) {
  if (!cfg.meta_dashboard_repo || !cfg.peer_repos || !cfg.peer_repos.length) return;
  const [owner, repo] = cfg.meta_dashboard_repo.split('/');
  const lines = [
    `# Cross-Repo PR Meta Dashboard`,
    ``,
    `_Last refresh: ${new Date().toISOString()}_`,
    ``,
    `| Repo | Open | Draft | Stale (>14d) | Avg age (d) |`,
    `|------|------|-------|--------------|-------------|`,
    ...perRepoSummaries.map(s => `| ${s.repo} | ${s.open} | ${s.draft} | ${s.stale} | ${s.avgAge} |`),
    ``,
    `Per-repo dashboards:`,
    ...perRepoSummaries.map(s => `- ${s.repo}: see issue with label \`pr-dashboard\``),
  ];
  const final = `${META_MARKER}\n${lines.join('\n')}`;
  try {
    const issues = await github.paginate(github.rest.issues.listForRepo, {
      owner, repo, state: 'open', labels: 'pr-meta-dashboard', per_page: 100,
    });
    if (issues.length) {
      await github.rest.issues.update({ owner, repo, issue_number: issues[0].number, body: final });
    } else {
      await github.rest.issues.create({
        owner, repo, title: 'Cross-Repo PR Meta Dashboard', body: final, labels: ['pr-meta-dashboard'],
      });
    }
  } catch (e) {
    core.warning(`Meta dashboard upsert failed: ${e.message}`);
  }
}

async function summarizePeerRepo(repoFull, token, core) {
  if (!token) return null;
  try {
    const { Octokit } = require('@octokit/rest');
    const peer = new Octokit({ auth: token });
    const [owner, repo] = repoFull.split('/');
    const open = await peer.paginate(peer.rest.pulls.list, {
      owner, repo, state: 'open', per_page: 100,
    });
    const draft = open.filter(p => p.draft).length;
    const stale = open.filter(p => ageDays(p.updated_at) > 14).length;
    const avgAge = open.length
      ? Math.round(open.reduce((s, p) => s + ageDays(p.created_at), 0) / open.length)
      : 0;
    return { repo: repoFull, open: open.length, draft, stale, avgAge };
  } catch (e) {
    core.warning(`Peer repo ${repoFull} summary failed: ${e.message}`);
    return { repo: repoFull, open: '?', draft: '?', stale: '?', avgAge: '?' };
  }
}

module.exports = async ({ github, context, core, crossRepoToken }) => {
  const { owner, repo } = context.repo;
  const repoFull = `${owner}/${repo}`;
  const cfg   = loadJson(CONFIG_PATH);
  const rules = loadJson(RULES_PATH);

  core.info(`Orchestrating ${repoFull}`);

  await ensureLabels(github, owner, repo, cfg, core);

  const openPRs = await fetchAllOpenPRs(github, owner, repo);
  core.info(`Fetched ${openPRs.length} open PRs`);

  // Hydrate detail (mergeable_state, additions/deletions, auto_merge) + files for dedupe.
  const detailed = [];
  for (const stub of openPRs) {
    try {
      const full = await getPRDetail(github, owner, repo, stub.number);
      await attachFiles(github, owner, repo, full);
      detailed.push(full);
    } catch (e) {
      core.warning(`Skipping #${stub.number}: ${e.message}`);
    }
  }

  // Duplicate detection (over open PRs only).
  const dupGroups = detectDuplicates(detailed, cfg.duplicate_similarity_threshold);
  const dupNumberMap = new Map(); // pr number -> [other pr numbers in cluster]
  for (const cluster of dupGroups) {
    for (const p of cluster) {
      dupNumberMap.set(p.number, cluster.filter(q => q.number !== p.number).map(q => q.number));
    }
  }

  const openRows = [];
  for (const pr of detailed) {
    const labelNames = (pr.labels || []).map(l => l.name);
    const wantLabels = classify(pr, rules);
    await applyMissingLabels(github, owner, repo, pr.number, pr.labels || [], wantLabels);
    const refreshedLabels = Array.from(new Set([...labelNames, ...wantLabels]));

    const ci = await getCIConclusion(github, owner, repo, pr.head.sha);

    const merge = await autoMerge(github, owner, repo, pr, refreshedLabels, cfg, core);
    if (merge.ok && merge.reason === 'enabled') {
      await applyMissingLabels(github, owner, repo, pr.number, pr.labels || [], ['auto-merge-enabled']);
    } else if (!merge.ok && !pr.draft && !refreshedLabels.includes('keep-open')) {
      await applyMissingLabels(github, owner, repo, pr.number, pr.labels || [], ['auto-merge-blocked']);
    }

    const rebase = await autoRebaseIfBehind(github, owner, repo, pr, refreshedLabels, cfg, core);
    if (rebase && rebase.startsWith('rebased')) {
      await applyMissingLabels(github, owner, repo, pr.number, pr.labels || [], ['needs-rebase']);
    }

    if (dupNumberMap.has(pr.number)) {
      const others = dupNumberMap.get(pr.number);
      await applyMissingLabels(github, owner, repo, pr.number, pr.labels || [], ['likely-duplicate']);
      const dupBody = [
        `**Likely duplicate of:** ${others.map(n => `#${n}`).join(', ')}`,
        ``,
        `Detected via title + filename n-gram similarity ≥ ${cfg.duplicate_similarity_threshold}.`,
        `If this is intentional, add the \`keep-open\` label to silence orchestrator suggestions.`,
      ].join('\n');
      await upsertComment(github, owner, repo, pr.number, DUP_MARKER, dupBody);
    }

    if (ageDays(pr.updated_at) > cfg.stale_warn_days
        && !refreshedLabels.includes('stale-warned')
        && !refreshedLabels.includes('keep-open')) {
      await applyMissingLabels(github, owner, repo, pr.number, pr.labels || [], ['stale-warned']);
      await upsertComment(github, owner, repo, pr.number, STALE_MARKER,
        `Idle for ${ageDays(pr.updated_at)} days (no activity since ${pr.updated_at}). ` +
        `Add the \`keep-open\` label to silence this warning. The orchestrator will **not** auto-close.`);
    }

    const recAction = merge.ok && merge.reason === 'enabled' ? 'auto-merge enabled'
      : merge.ok ? 'auto-merge already on'
      : `manual: ${merge.reason}`;
    const stickyBody = [
      `### PR Orchestrator status`,
      ``,
      `- **State:** ${pr.state}${pr.draft ? ' (draft)' : ''}`,
      `- **Mergeable:** \`${pr.mergeable_state || 'unknown'}\``,
      `- **CI:** \`${ci}\``,
      `- **Age:** ${ageDays(pr.created_at)} day(s) since open, ${ageDays(pr.updated_at)} day(s) since update`,
      `- **Labels:** ${refreshedLabels.join(', ') || '(none)'}`,
      `- **Recommended action:** ${recAction}`,
      rebase ? `- **Rebase:** ${rebase}` : null,
      dupNumberMap.has(pr.number) ? `- **Duplicate of:** ${dupNumberMap.get(pr.number).map(n => `#${n}`).join(', ')}` : null,
      ``,
      `_Last refreshed by orchestrator at ${new Date().toISOString()}._`,
    ].filter(Boolean).join('\n');
    await upsertComment(github, owner, repo, pr.number, STICKY_MARKER, stickyBody);

    openRows.push(rowFor(pr, ci, pr.mergeable_state || '?', merge.ok ? '✅' : '⛔'));
  }

  // Closed/merged within window.
  const recentClosed = await fetchRecentClosed(github, owner, repo, 14);
  const mergedRows = [];
  const closedRows = [];
  for (const pr of recentClosed) {
    const row = rowFor(pr, '-', '-', pr.merged_at ? '✅ merged' : '❌ closed');
    if (pr.merged_at) mergedRows.push(row); else closedRows.push(row);
  }

  const generatedAt = new Date().toISOString();
  const indexBody = renderIndex(repoFull, openRows, mergedRows, closedRows, dupGroups, generatedAt);
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, indexBody);
  core.info(`Wrote ${INDEX_PATH}`);

  // Metrics CSV (append, with header on first run).
  const headerLine = 'timestamp,repo,open,draft,stale_gt_14d,merged_recent,avg_age_days';
  const newRow = renderMetricsRow(repoFull, detailed, mergedRows.length, generatedAt);
  if (!fs.existsSync(METRICS_PATH)) {
    fs.writeFileSync(METRICS_PATH, `${headerLine}\n${newRow}\n`);
  } else {
    fs.appendFileSync(METRICS_PATH, `${newRow}\n`);
  }

  await upsertDashboardIssue(github, owner, repo, indexBody, core);

  // Cross-repo meta dashboard (only when this repo IS the meta dashboard host).
  if (`${owner}/${repo}`.toLowerCase() === (cfg.meta_dashboard_repo || '').toLowerCase()) {
    const selfSummary = {
      repo: repoFull,
      open: detailed.length,
      draft: detailed.filter(p => p.draft).length,
      stale: detailed.filter(p => ageDays(p.updated_at) > 14).length,
      avgAge: detailed.length
        ? Math.round(detailed.reduce((s, p) => s + ageDays(p.created_at), 0) / detailed.length)
        : 0,
    };
    const peerSummaries = [];
    for (const peer of cfg.peer_repos || []) {
      const summary = await summarizePeerRepo(peer, crossRepoToken, core);
      if (summary) peerSummaries.push(summary);
    }
    await upsertMetaDashboard(github, crossRepoToken, cfg, [selfSummary, ...peerSummaries], core);
  }

  core.info(`Done. Open=${detailed.length}, dup-clusters=${dupGroups.length}, merged-recent=${mergedRows.length}`);
};
