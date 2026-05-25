#!/usr/bin/env node
'use strict';
const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: ua-tour-analyze.js <input.json> <output.json>');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
} catch (e) {
  console.error('Error reading input:', e.message);
  process.exit(1);
}

const { nodes, edges, layers } = data;

const nodeIdSet = new Set(nodes.map(n => n.id));
// Only count edges where both source and target exist in nodes
const validEdges = edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));

// A. Fan-In Ranking
const fanIn = {};
const fanOut = {};
for (const n of nodes) {
  fanIn[n.id] = 0;
  fanOut[n.id] = 0;
}
for (const e of validEdges) {
  fanIn[e.target] = (fanIn[e.target] || 0) + 1;
  fanOut[e.source] = (fanOut[e.source] || 0) + 1;
}
const fanInRanking = nodes
  .map(n => ({ id: n.id, fanIn: fanIn[n.id], name: n.name }))
  .sort((a, b) => b.fanIn - a.fanIn)
  .slice(0, 20);

const fanOutRanking = nodes
  .map(n => ({ id: n.id, fanOut: fanOut[n.id], name: n.name }))
  .sort((a, b) => b.fanOut - a.fanOut)
  .slice(0, 20);

// C. Entry Point Candidates
const entryPointPatterns = [
  /^index\.(ts|js)$/, /^main\.(ts|js)$/, /^app\.(ts|js)$/,
  /^server\.(ts|js)$/, /^mod\.rs$/, /^main\.go$/, /^main\.py$/,
  /^main\.rs$/, /^manage\.py$/, /^app\.py$/, /^wsgi\.py$/,
  /^asgi\.py$/, /^run\.py$/, /^__main__\.py$/, /^Application\.java$/,
  /^Main\.java$/, /^Program\.cs$/, /^config\.ru$/, /^index\.php$/,
  /^App\.swift$/, /^Application\.kt$/, /^main\.cpp$/, /^main\.c$/
];

const maxFanOut = Math.max(...nodes.map(n => fanOut[n.id] || 0));
const fanOutValues = nodes.map(n => fanIn[n.id] || 0).sort((a, b) => a - b);
const bottom25Threshold = fanOutValues[Math.floor(fanOutValues.length * 0.25)];

const entryScores = nodes.map(n => {
  let score = 0;
  if (n.type === 'file') {
    const name = n.name || '';
    if (entryPointPatterns.some(p => p.test(name))) score += 3;
    // File at project root or one level deep
    const fp = n.filePath || '';
    const depth = fp.split('/').length;
    if (depth <= 2) score += 1;
    // High fan-out (top 10%)
    if (fanOut[n.id] >= maxFanOut * 0.9) score += 1;
    // Low fan-in (bottom 25%)
    if (fanIn[n.id] <= bottom25Threshold) score += 1;
  }
  if (n.type === 'document') {
    const name = n.name || '';
    const fp = n.filePath || '';
    if (name === 'README.md' && fp.split('/').length === 1) score += 5;
    else if (name.endsWith('.md') && fp.split('/').length === 1) score += 2;
  }
  return { id: n.id, score, name: n.name, summary: n.summary || '' };
});
entryScores.sort((a, b) => b.score - a.score);
const entryPointCandidates = entryScores.slice(0, 5);

// D. BFS Traversal (from top code entry point)
const codeEntry = entryPointCandidates.find(e => e.id.startsWith('file:'));
const bfsStartNode = codeEntry ? codeEntry.id : null;

let bfsTraversal = { startNode: bfsStartNode, order: [], depthMap: {}, byDepth: {} };
if (bfsStartNode) {
  const importsEdges = validEdges.filter(e => e.type === 'imports' || e.type === 'calls');
  const adjList = {};
  for (const e of importsEdges) {
    if (!adjList[e.source]) adjList[e.source] = [];
    adjList[e.source].push(e.target);
  }
  const visited = new Set();
  const queue = [{ id: bfsStartNode, depth: 0 }];
  visited.add(bfsStartNode);
  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    bfsTraversal.order.push(id);
    bfsTraversal.depthMap[id] = depth;
    if (!bfsTraversal.byDepth[String(depth)]) bfsTraversal.byDepth[String(depth)] = [];
    bfsTraversal.byDepth[String(depth)].push(id);
    const neighbors = adjList[id] || [];
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push({ id: nb, depth: depth + 1 });
      }
    }
  }
}

// E. Non-Code File Inventory
const nonCodeFiles = {
  documentation: [],
  infrastructure: [],
  data: [],
  config: []
};
for (const n of nodes) {
  const entry = { id: n.id, name: n.name, type: n.type, summary: n.summary || '' };
  if (n.type === 'document') nonCodeFiles.documentation.push(entry);
  else if (n.type === 'service' || n.type === 'pipeline') nonCodeFiles.infrastructure.push(entry);
  else if (n.type === 'table' || n.type === 'schema' || n.type === 'endpoint') nonCodeFiles.data.push(entry);
  else if (n.type === 'config') nonCodeFiles.config.push(entry);
}

// F. Tightly Coupled Clusters
// Find pairs with bidirectional relationships
const edgePairs = {};
for (const e of validEdges) {
  const key = [e.source, e.target].sort().join('|||');
  if (!edgePairs[key]) edgePairs[key] = { a: e.source, b: e.target, count: 0 };
  edgePairs[key].count++;
}
const bidirPairs = Object.values(edgePairs).filter(p => {
  // Check if both directions exist (A->B and B->A)
  const forward = validEdges.some(e => e.source === p.a && e.target === p.b);
  const backward = validEdges.some(e => e.source === p.b && e.target === p.a);
  return forward && backward;
});

// Build adjacency for cluster expansion
const adjAll = {};
for (const e of validEdges) {
  if (!adjAll[e.source]) adjAll[e.source] = new Set();
  if (!adjAll[e.target]) adjAll[e.target] = new Set();
  adjAll[e.source].add(e.target);
  adjAll[e.target].add(e.source);
}

const clusters = [];
const usedInCluster = new Set();

for (const pair of bidirPairs) {
  if (usedInCluster.has(pair.a) && usedInCluster.has(pair.b)) continue;
  const cluster = new Set([pair.a, pair.b]);
  // Expand: add nodes connected to 2+ cluster members
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (cluster.has(n.id)) continue;
      const connections = adjAll[n.id] ? [...adjAll[n.id]].filter(x => cluster.has(x)).length : 0;
      if (connections >= 2) {
        cluster.add(n.id);
        changed = true;
      }
    }
  }
  // Only add if at least one member not already used
  const clusterArr = [...cluster];
  if (clusterArr.length >= 2 && clusterArr.length <= 5) {
    let overlaps = false;
    for (const cid of clusterArr) {
      if (usedInCluster.has(cid)) { overlaps = true; break; }
    }
    if (!overlaps) {
      for (const cid of clusterArr) usedInCluster.add(cid);
      // Count edges within cluster
      let edgeCount = 0;
      for (const e of validEdges) {
        if (clusterArr.includes(e.source) && clusterArr.includes(e.target)) edgeCount++;
      }
      clusters.push({ nodes: clusterArr, edgeCount });
    }
  }
}
// Sort by edge count desc, take top 10
clusters.sort((a, b) => b.edgeCount - a.edgeCount);
const topClusters = clusters.slice(0, 10);

// G. Layer List
const layerList = {
  count: layers.length,
  list: layers.map(l => ({ id: l.id, name: l.name, description: l.description }))
};

// H. Node Summary Index
const nodeSummaryIndex = {};
for (const n of nodes) {
  nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary || '' };
}

// Assemble output
const result = {
  scriptCompleted: true,
  entryPointCandidates,
  fanInRanking,
  fanOutRanking,
  bfsTraversal,
  nonCodeFiles,
  clusters: topClusters,
  layers: layerList,
  nodeSummaryIndex,
  totalNodes: nodes.length,
  totalEdges: validEdges.length
};

try {
  fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('Analysis complete. Output written to', outputPath);
  process.exit(0);
} catch (e) {
  console.error('Error writing output:', e.message);
  process.exit(1);
}
