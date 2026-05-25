const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node ua-arch-analyze.js <input.json> <output.json>');
  process.exit(1);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (e) {
  console.error('Failed to read input:', e.message);
  process.exit(1);
}

const { fileNodes, importEdges, allEdges } = input;
const allNodes = fileNodes;
const totalFileNodes = allNodes.length;

function getPath(id) {
  const node = allNodes.find(n => n.id === id);
  return node ? node.filePath || '' : '';
}

function getNodeType(id) {
  return id.split(':')[0];
}

// --- A. Directory Grouping ---
const allPaths = allNodes.map(n => n.filePath || '').filter(p => p);

function commonPrefix(paths) {
  if (!paths.length) return '';
  let p = paths[0];
  if (!p) return '';
  for (const s of paths.slice(1)) {
    if (!s) continue;
    while (s.indexOf(p) !== 0) {
      p = p.slice(0, -1);
      if (!p) return '';
    }
  }
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(0, idx + 1) : '';
}

const prefix = commonPrefix(allPaths);

function getGroup(filePath) {
  if (!filePath) return 'root';
  let rel = filePath;
  if (prefix && filePath.startsWith(prefix)) {
    rel = filePath.slice(prefix.length);
  }
  const parts = rel.split('/').filter(Boolean);
  if (parts.length === 0) return 'root';

  // Handle .github directory
  if (parts[0] === '.github') return '.github';
  if (parts[0] === '.changeset') return 'changeset';
  if (parts[0] === '.devcontainer') return 'devcontainer';
  if (parts[0] === '.bolt') return 'bolt';
  if (parts[0] === 'docs') return 'docs';
  if (parts[0] === 'content') return 'content';
  if (parts[0] === 'prototype') return 'prototype';

  // Root-level files (no directory)
  if (parts.length === 1 && filePath.indexOf('/') === -1) {
    const name = filePath.split('/').pop();
    if (name === 'Caddyfile' || name === 'Makefile') return 'infra-root';
    if (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.toml') || name.startsWith('.')) return 'root-config';
    if (name.endsWith('.md')) return 'root-docs';
    if (name.endsWith('.sh')) return 'scripts';
    if (name === 'Dockerfile' || name.startsWith('Dockerfile')) return 'infra-root';
    return 'root';
  }

  // ag-associates-ai/backend
  if (parts[0] === 'ag-associates-ai' && parts[1] === 'backend') {
    if (!parts[2]) return 'ag-ai-backend';
    const sub = parts[2];
    if (sub === 'agents') return 'ag-ai-agents';
    if (sub === 'routes') return 'ag-ai-routes';
    if (sub === 'services') return 'ag-ai-services';
    if (sub === 'models') return 'ag-ai-models';
    if (sub === 'utils') return 'ag-ai-utils';
    if (sub === 'payment') return 'ag-ai-payment';
    if (sub === 'docs') return 'ag-ai-docs';
    if (sub === 'frontend') {
      if (!parts[3]) return 'ag-ai-front-root';
      if (parts[3] === 'public') return 'ag-ai-front-public';
      if (parts[3] === 'src') {
        if (!parts[4]) return 'ag-ai-front-src';
        if (parts[4] === 'pages') return 'ag-ai-front-pages';
        if (parts[4] === 'components') return 'ag-ai-front-components';
        if (parts[4] === 'hooks') return 'ag-ai-front-hooks';
        if (parts[4] === 'api') return 'ag-ai-front-api';
        if (parts[4] === 'types') return 'ag-ai-front-types';
        if (parts[4] === 'data') return 'ag-ai-front-data';
        return 'ag-ai-front-src';
      }
      return 'ag-ai-front-root';
    }
    return 'ag-ai-backend';
  }
  if (parts[0] === 'ag-associates-ai' && parts[1] === 'database') return 'ag-ai-database';

  // ag-platform
  if (parts[0] === 'ag-platform') {
    if (!parts[1]) return 'ag-platform-root';
    if (parts[1] === 'apps' && parts[2] === 'mobile') {
      if (!parts[3]) return 'ag-platform-mobile';
      if (parts[3] === 'app') {
        if (parts[4] === '(app)') return 'ag-platform-mobile-screens';
        return 'ag-platform-mobile-app';
      }
      if (parts[3] === 'components') return 'ag-platform-mobile-components';
      if (parts[3] === 'hooks') return 'ag-platform-mobile-hooks';
      if (parts[3] === 'lib') return 'ag-platform-mobile-lib';
      if (parts[3] === 'services') return 'ag-platform-mobile-services';
      if (parts[3] === 'types') return 'ag-platform-mobile-types';
      return 'ag-platform-mobile';
    }
    if (parts[1] === 'packages') {
      if (!parts[2]) return 'ag-platform-packages';
      if (parts[2] === 'ai') return 'ag-platform-pkg-ai';
      if (parts[2] === 'db') return 'ag-platform-pkg-db';
      if (parts[2] === 'types') return 'ag-platform-pkg-types';
      if (parts[2] === 'ui') return 'ag-platform-pkg-ui';
      return 'ag-platform-packages';
    }
    if (parts[1] === 'services' && parts[2] === 'intake-api') return 'ag-platform-intake';
    if (parts[1] === 'supabase') {
      if (parts[2] === 'functions') return 'ag-platform-supabase-functions';
      if (parts[2] === 'migrations') return 'ag-platform-supabase-migrations';
      return 'ag-platform-supabase';
    }
    if (parts[1] === 'src') {
      if (!parts[2]) return 'ag-platform-src';
      if (parts[2] === 'app') return 'ag-platform-app';
      if (parts[2] === 'components') return 'ag-platform-components';
      if (parts[2] === 'hooks') return 'ag-platform-hooks';
      if (parts[2] === 'store') return 'ag-platform-store';
      if (parts[2] === 'types') return 'ag-platform-types';
      if (parts[2] === 'lib') return 'ag-platform-lib';
      if (parts[2] === 'server') return 'ag-platform-server';
      return 'ag-platform-src';
    }
    if (parts[1] === 'docs') return 'ag-platform-docs';
    return 'ag-platform-root';
  }

  return parts[0];
}

const directoryGroups = {};
for (const node of allNodes) {
  const g = getGroup(node.filePath || '');
  if (!directoryGroups[g]) directoryGroups[g] = [];
  directoryGroups[g].push(node.id);
}

// --- B. Node Type Grouping ---
const nodeTypeGroups = {};
for (const node of allNodes) {
  const t = getNodeType(node.id);
  if (!nodeTypeGroups[t]) nodeTypeGroups[t] = [];
  nodeTypeGroups[t].push(node.id);
}

// --- C. Import Adjacency ---
const fileFanIn = {};
const fileFanOut = {};
for (const node of allNodes) {
  fileFanIn[node.id] = 0;
  fileFanOut[node.id] = 0;
}
for (const edge of importEdges) {
  if (fileFanOut[edge.source] !== undefined) fileFanOut[edge.source]++;
  if (fileFanIn[edge.target] !== undefined) fileFanIn[edge.target]++;
}
const sortedFanIn = Object.entries(fileFanIn).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 20);
const sortedFanOut = Object.entries(fileFanOut).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 20);
const fileFanInObj = Object.fromEntries(sortedFanIn);
const fileFanOutObj = Object.fromEntries(sortedFanOut);

// --- D. Cross-Category Dependency Analysis ---
const crossCategoryEdges = {};
for (const edge of allEdges) {
  const fromType = getNodeType(edge.source);
  const toType = getNodeType(edge.target);
  const key = fromType + '->' + toType + ':' + edge.type;
  if (!crossCategoryEdges[key]) crossCategoryEdges[key] = { fromType, toType, edgeType: edge.type, count: 0 };
  crossCategoryEdges[key].count++;
}

// --- E. Inter-Group Import Frequency ---
const interGroupImports = {};
for (const edge of importEdges) {
  const srcPath = getPath(edge.source);
  const tgtPath = getPath(edge.target);
  const fromGroup = getGroup(srcPath);
  const toGroup = getGroup(tgtPath);
  if (fromGroup && toGroup && fromGroup !== toGroup) {
    const key = fromGroup + '->' + toGroup;
    if (!interGroupImports[key]) interGroupImports[key] = { from: fromGroup, to: toGroup, count: 0 };
    interGroupImports[key].count++;
  }
}

// --- F. Intra-Group Import Density ---
const groupInternalCounts = {};
const groupTotalCounts = {};
for (const g of Object.keys(directoryGroups)) {
  groupInternalCounts[g] = 0;
  groupTotalCounts[g] = 0;
}
for (const edge of importEdges) {
  const srcPath = getPath(edge.source);
  const tgtPath = getPath(edge.target);
  const fromGroup = getGroup(srcPath);
  const toGroup = getGroup(tgtPath);
  if (groupTotalCounts[fromGroup] !== undefined) groupTotalCounts[fromGroup]++;
  if (fromGroup && fromGroup === toGroup && groupInternalCounts[fromGroup] !== undefined) groupInternalCounts[fromGroup]++;
}
const intraGroupDensity = {};
for (const g of Object.keys(directoryGroups)) {
  const internal = groupInternalCounts[g] || 0;
  const total = groupTotalCounts[g] || 0;
  intraGroupDensity[g] = { internalEdges: internal, totalEdges: total, density: total > 0 ? +(internal / total).toFixed(2) : 0 };
}

// --- G. Directory Pattern Matching ---
const patternMap = {
  'ag-ai-agents': 'service',
  'ag-ai-routes': 'api',
  'ag-ai-services': 'service',
  'ag-ai-models': 'data',
  'ag-ai-utils': 'utility',
  'ag-ai-payment': 'service',
  'ag-ai-docs': 'documentation',
  'ag-ai-database': 'data',
  'ag-ai-front-pages': 'ui',
  'ag-ai-front-components': 'ui',
  'ag-ai-front-hooks': 'hooks',
  'ag-ai-front-api': 'api',
  'ag-ai-front-types': 'types',
  'ag-ai-front-data': 'data',
  'ag-ai-front-public': 'assets',
  'ag-ai-front-root': 'ui',
  'ag-ai-front-src': 'ui',
  'ag-ai-backend': 'service',
  'ag-platform-mobile-screens': 'ui',
  'ag-platform-mobile-components': 'ui',
  'ag-platform-mobile-hooks': 'hooks',
  'ag-platform-mobile-lib': 'utility',
  'ag-platform-mobile-services': 'service',
  'ag-platform-mobile-types': 'types',
  'ag-platform-mobile-app': 'ui',
  'ag-platform-mobile': 'ui',
  'ag-platform-pkg-ai': 'service',
  'ag-platform-pkg-db': 'data',
  'ag-platform-pkg-types': 'types',
  'ag-platform-pkg-ui': 'ui',
  'ag-platform-intake': 'api',
  'ag-platform-supabase': 'data',
  'ag-platform-supabase-functions': 'service',
  'ag-platform-supabase-migrations': 'data',
  'ag-platform-app': 'ui',
  'ag-platform-components': 'ui',
  'ag-platform-hooks': 'hooks',
  'ag-platform-store': 'state',
  'ag-platform-types': 'types',
  'ag-platform-lib': 'utility',
  'ag-platform-server': 'service',
  'ag-platform-docs': 'documentation',
  'ag-platform-root': 'config',
  'ag-platform-src': 'ui',
  'ag-platform-packages': 'config',
  'scripts': 'infrastructure',
  'prototype': 'ui',
  'docs': 'documentation',
  'content': 'assets',
  'tasks': 'documentation',
  'changeset': 'config',
  'devcontainer': 'infrastructure',
  'bolt': 'config',
  '.github': 'ci-cd',
  'root-config': 'config',
  'root-docs': 'documentation',
  'infra-root': 'infrastructure',
  'root': 'config',
};

const patternMatches = {};
for (const g of Object.keys(directoryGroups)) {
  if (patternMap[g]) patternMatches[g] = patternMap[g];
}

// --- H. Deployment Topology ---
const infraFiles = [];
let hasDockerfile = false, hasCompose = false, hasK8s = false, hasTerraform = false, hasCI = false;
for (const node of allNodes) {
  const fp = node.filePath || '';
  const name = node.name || '';
  if (name === 'Dockerfile' || name.startsWith('Dockerfile.')) hasDockerfile = true;
  if (/docker-compose/.test(name)) hasCompose = true;
  if (/\.github\/workflows/.test(fp)) { hasCI = true; if (!infraFiles.includes(node.id)) infraFiles.push(node.id); }
  if (name === 'Dockerfile' || name.startsWith('Dockerfile.') || /docker-compose/.test(name) || name === 'Caddyfile') {
    if (!infraFiles.includes(node.id)) infraFiles.push(node.id);
  }
}
const deploymentTopology = { hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI, infraFiles };

// --- I. Data Pipeline ---
const dataPipeline = { schemaFiles: [], migrationFiles: [], dataModelFiles: [], apiHandlerFiles: [] };
for (const node of allNodes) {
  const fp = node.filePath || '';
  const type = getNodeType(node.id);
  if (type === 'table' && /schema/.test(fp)) dataPipeline.schemaFiles.push(node.id);
  if (type === 'table' && /migration/.test(fp)) dataPipeline.migrationFiles.push(node.id);
  if (type === 'table' && /migrations/.test(fp)) dataPipeline.migrationFiles.push(node.id);
  if (node.tags && (node.tags.includes('data-model') || node.tags.includes('database'))) dataPipeline.dataModelFiles.push(node.id);
  if (node.tags && node.tags.includes('api-handler')) dataPipeline.apiHandlerFiles.push(node.id);
}

// --- J. Documentation Coverage ---
const groupsWithDocs = new Set();
for (const node of allNodes) {
  if (getNodeType(node.id) === 'document') {
    const g = getGroup(node.filePath || '');
    if (g) groupsWithDocs.add(g);
  }
}
const totalGroups = Object.keys(directoryGroups).length;
const docCoverage = {
  groupsWithDocs: groupsWithDocs.size,
  totalGroups,
  coverageRatio: totalGroups > 0 ? +(groupsWithDocs.size / totalGroups).toFixed(2) : 0,
  undocumentedGroups: Object.keys(directoryGroups).filter(g => !groupsWithDocs.has(g))
};

// --- K. Dependency Direction ---
const directionMap = {};
for (const edge of importEdges) {
  const srcPath = getPath(edge.source);
  const tgtPath = getPath(edge.target);
  const fromGroup = getGroup(srcPath);
  const toGroup = getGroup(tgtPath);
  if (fromGroup && toGroup && fromGroup !== toGroup) {
    directionMap[fromGroup + '->' + toGroup] = (directionMap[fromGroup + '->' + toGroup] || 0) + 1;
  }
}

const dependencyDirection = [];
const seen = new Set();
for (const [key, count] of Object.entries(directionMap)) {
  const [dep, depOn] = key.split('->');
  const revKey = depOn + '->' + dep;
  const revCount = directionMap[revKey] || 0;
  const pairKey = [dep, depOn].sort().join('|');
  if (seen.has(pairKey)) continue;
  seen.add(pairKey);
  if (count > revCount) {
    dependencyDirection.push({ dependent: dep, dependsOn: depOn });
  } else if (revCount > count) {
    dependencyDirection.push({ dependent: depOn, dependsOn: dep });
  }
}

// --- File Stats ---
const filesPerGroup = {};
for (const [g, ids] of Object.entries(directoryGroups)) {
  filesPerGroup[g] = ids.length;
}
const nodeTypeCounts = {};
for (const [t, ids] of Object.entries(nodeTypeGroups)) {
  nodeTypeCounts[t] = ids.length;
}

const output = {
  scriptCompleted: true,
  directoryGroups,
  nodeTypeGroups,
  crossCategoryEdges: Object.values(crossCategoryEdges),
  interGroupImports: Object.values(interGroupImports),
  intraGroupDensity,
  patternMatches,
  deploymentTopology,
  dataPipeline,
  docCoverage,
  dependencyDirection,
  fileStats: { totalFileNodes, filesPerGroup, nodeTypeCounts },
  fileFanIn: fileFanInObj,
  fileFanOut: fileFanOutObj
};

const outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log('Script completed successfully');
process.exit(0);
