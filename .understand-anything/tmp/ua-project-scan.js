#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const IGNORE_PKG = '/home/luxor9/.understand-anything/repo/understand-anything-plugin/packages/core/node_modules/ignore';
const ignore = require(IGNORE_PKG);

// Replicated from @understand-anything/core DEFAULT_IGNORE_PATTERNS
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/', '.git/', 'vendor/', 'venv/', '.venv/', '__pycache__/',
  'dist/', 'build/', 'out/', 'coverage/', '.next/', '.cache/', '.turbo/', 'target/', 'obj/',
  '*.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico', '*.woff', '*.woff2', '*.ttf', '*.eot',
  '*.mp3', '*.mp4', '*.pdf', '*.zip', '*.tar', '*.gz',
  '*.min.js', '*.min.css', '*.map', '*.generated.*',
  '.idea/', '.vscode/',
  'LICENSE', '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc*', '*.log',
];

const LANGUAGE_MAP = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.h': 'cpp', '.hpp': 'cpp',
  '.c': 'c',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.php': 'php',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.sh': 'shell', '.bash': 'shell',
  '.ps1': 'powershell',
  '.bat': 'batch', '.cmd': 'batch',
  '.md': 'markdown', '.rst': 'markdown',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.toml': 'toml',
  '.sql': 'sql',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.proto': 'protobuf',
  '.tf': 'terraform', '.tfvars': 'terraform',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css', '.sass': 'css', '.less': 'css',
  '.xml': 'xml',
  '.cfg': 'config', '.ini': 'config', '.env': 'config',
};

function detectLanguage(filePath) {
  const base = path.basename(filePath);
  if (base === 'Dockerfile') return 'dockerfile';
  if (base === 'Makefile') return 'makefile';
  if (base === 'Jenkinsfile') return 'jenkinsfile';
  const ext = path.extname(filePath).toLowerCase();
  if (LANGUAGE_MAP[ext]) return LANGUAGE_MAP[ext];
  if (ext) return ext.replace(/^\./, '');
  return 'unknown';
}

function getFileCategory(filePath, language) {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // infra (check first - most specific)
  if (base === 'Dockerfile' || base.match(/^docker-compose\./)) return 'infra';
  if (ext === '.tf' || ext === '.tfvars') return 'infra';
  if (base === 'Makefile' || base === 'Jenkinsfile' || base === 'Procfile' || base === 'Vagrantfile') return 'infra';
  if (filePath.match(/(^|\/)\.github\/workflows\//)) return 'infra';
  if (base === '.gitlab-ci.yml') return 'infra';
  if (filePath.match(/(^|\/)\.circleci\//)) return 'infra';
  if (filePath.match(/(^|\/)k8s\//) || filePath.match(/(^|\/)kubernetes\//)) return 'infra';
  if (base.match(/.*\.k8s\.ya?ml$/)) return 'infra';

  // data
  if (ext === '.sql' || ext === '.graphql' || ext === '.gql' || ext === '.proto' || ext === '.csv') return 'data';
  if (ext === '.prisma') return 'data';
  if (base.match(/\.schema\.json$/)) return 'data';

  // script
  if (ext === '.sh' || ext === '.bash' || ext === '.ps1' || ext === '.bat') return 'script';

  // markup
  if (ext === '.html' || ext === '.htm' || ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') return 'markup';

  // config
  if (['.yaml', '.yml', '.json', '.jsonc', '.toml', '.xml', '.cfg', '.ini', '.env'].includes(ext)) return 'config';
  if (base === 'tsconfig.json' || base === 'package.json' || base === 'pyproject.toml' || base === 'Cargo.toml' || base === 'go.mod') return 'config';

  // docs
  if (ext === '.md' || ext === '.rst' || ext === '.txt') return 'docs';

  // code (everything else)
  return 'code';
}

function detectFrameworks(allFiles, projectRoot) {
  const frameworks = new Set();

  // Check for Docker
  if (allFiles.some(f => path.basename(f) === 'Dockerfile')) frameworks.add('Docker');
  if (allFiles.some(f => path.basename(f).startsWith('docker-compose'))) frameworks.add('Docker Compose');
  if (allFiles.some(f => f.endsWith('.tf') || f.endsWith('.tfvars'))) frameworks.add('Terraform');
  if (allFiles.some(f => f.includes('.github/workflows/'))) frameworks.add('GitHub Actions');
  if (allFiles.some(f => f.endsWith('.gitlab-ci.yml'))) frameworks.add('GitLab CI');
  if (allFiles.some(f => path.basename(f) === 'Jenkinsfile')) frameworks.add('Jenkins');

  // Read package.json files
  const KNOWN_JS_FRAMEWORKS = ['react','vue','svelte','@angular/core','express','fastify','koa','next','nuxt','vite','vitest','jest','mocha','tailwindcss','prisma','typeorm','sequelize','mongoose','redux','zustand','mobx'];

  const packageJsonFiles = allFiles.filter(f => path.basename(f) === 'package.json');
  for (const pjf of packageJsonFiles) {
    try {
      const absPath = path.join(projectRoot, pjf);
      const content = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
      const name = content.name || '';
      const desc = content.description || '';
      const deps = { ...(content.dependencies || {}), ...(content.devDependencies || {}) };
      for (const [depName, depVer] of Object.entries(deps)) {
        for (const known of KNOWN_JS_FRAMEWORKS) {
          if (depName === known || depName.startsWith(known + '/')) {
            // Capitalize nicely
            let label = known;
            if (known === '@angular/core') label = 'Angular';
            else if (known === 'next') label = 'Next.js';
            else if (known === 'nuxt') label = 'Nuxt';
            else if (known === 'vite') label = 'Vite';
            else if (known === 'vitest') label = 'Vitest';
            else if (known === 'prisma') label = 'Prisma';
            else if (known === 'tailwindcss') label = 'Tailwind CSS';
            else if (known === 'express') label = 'Express';
            else if (known === 'fastify') label = 'Fastify';
            else if (known === 'zustand') label = 'Zustand';
            else label = known.charAt(0).toUpperCase() + known.slice(1);
            frameworks.add(label);
          }
        }
      }
      if (content.dependencies?.['next'] || content.devDependencies?.['next']) frameworks.add('Next.js');
      if (content.dependencies?.['react'] || content.devDependencies?.['react'] ||
          content.dependencies?.['react-dom'] || content.devDependencies?.['react-dom']) {
        // Check if also uses react-native
        if (content.dependencies?.['react-native']) {
          frameworks.add('React Native');
        } else {
          frameworks.add('React');
        }
      }
    } catch (e) { /* skip unparseable package.json */ }
  }

  // Python framework detection
  const KNOWN_PYTHON_FW = ['django','djangorestframework','fastapi','flask','sqlalchemy','alembic','celery','pydantic','uvicorn','gunicorn','aiohttp','tornado','starlette','pytest','hypothesis','channels'];

  const reqFiles = allFiles.filter(f => path.basename(f) === 'requirements.txt');
  for (const rf of reqFiles) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, rf), 'utf-8');
      for (const line of content.split('\n')) {
        const clean = line.replace(/#.*$/, '').trim().split(/[<>=!~]+/)[0].trim().toLowerCase();
        if (!clean) continue;
        for (const known of KNOWN_PYTHON_FW) {
          if (clean === known) {
            let label = known.charAt(0).toUpperCase() + known.slice(1);
            if (known === 'djangorestframework') label = 'Django REST Framework';
            if (known === 'fastapi') label = 'FastAPI';
            if (known === 'sqlalchemy') label = 'SQLAlchemy';
            if (known === 'pydantic') label = 'Pydantic';
            if (known === 'uvicorn') label = 'Uvicorn';
            frameworks.add(label);
          }
        }
      }
    } catch (e) { /* skip */ }
  }

  // Check for pyproject.toml
  const pyprojectFiles = allFiles.filter(f => path.basename(f) === 'pyproject.toml');
  for (const pf of pyprojectFiles) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, pf), 'utf-8');
      // Simple line-based scan
      const lines = content.split('\n');
      for (const line of lines) {
        const clean = line.trim();
        for (const known of KNOWN_PYTHON_FW) {
          if (clean.toLowerCase().includes(known)) {
            let label = known.charAt(0).toUpperCase() + known.slice(1);
            if (known === 'fastapi') label = 'FastAPI';
            if (known === 'pydantic') label = 'Pydantic';
            if (known === 'uvicorn') label = 'Uvicorn';
            frameworks.add(label);
          }
        }
      }
      if (content.includes('[tool.pytest.ini_options]')) frameworks.add('pytest');
      if (content.includes('[tool.django]')) frameworks.add('Django');
    } catch (e) { /* skip */ }
  }

  // Check for tsconfig.json → TypeScript
  if (allFiles.some(f => path.basename(f) === 'tsconfig.json')) frameworks.add('TypeScript');

  // Check for turbo.json → Turborepo
  if (allFiles.some(f => path.basename(f) === 'turbo.json')) frameworks.add('Turborepo');

  return [...frameworks].sort();
}

function extractProjectName(allFiles, projectRoot) {
  // 1. package.json
  const pjFile = allFiles.filter(f => path.basename(f) === 'package.json' && !f.includes('node_modules'));
  if (pjFile.length > 0) {
    // Try root first
    const rootPj = pjFile.find(f => f === 'package.json');
    if (rootPj) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, rootPj), 'utf-8'));
        if (pkg.name) return pkg.name;
      } catch (e) {}
    }
    for (const f of pjFile) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, f), 'utf-8'));
        if (pkg.name && !pkg.name.startsWith('@')) return pkg.name;
      } catch (e) {}
    }
  }
  return path.basename(projectRoot);
}

function extractReadmeHead(allFiles, projectRoot) {
  const readme = allFiles.find(f => path.basename(f).toLowerCase() === 'readme.md');
  if (!readme) return '';
  try {
    const content = fs.readFileSync(path.join(projectRoot, readme), 'utf-8');
    return content.split('\n').slice(0, 10).join('\n');
  } catch (e) { return ''; }
}

function getRawDescription(allFiles, projectRoot) {
  const pjFile = allFiles.find(f => f === 'package.json');
  if (!pjFile) return '';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, pjFile), 'utf-8'));
    return pkg.description || '';
  } catch (e) { return ''; }
}

// --- Import Resolution ---

function resolveTSAliases(projectRoot, allFilesSet) {
  // Collect all tsconfig.json path aliases
  const aliases = [];
  const tsconfigFiles = allFiles.filter(f => path.basename(f) === 'tsconfig.json');
  for (const tf of tsconfigFiles) {
    try {
      const absPath = path.join(projectRoot, tf);
      const content = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
      const baseDir = path.dirname(tf);
      const comp = content.compilerOptions || {};
      const baseUrl = comp.baseUrl || '.';
      const paths = comp.paths || {};
      const resolvedBase = path.posix.join(baseDir, baseUrl).replace(/\\/g, '/');
      for (const [alias, targets] of Object.entries(paths)) {
        // alias is like "@/*" or "@ag/types"
        const prefix = alias.replace(/\*$/, '');
        for (const target of targets) {
          const targetPath = target.replace(/\*$/, '');
          const resolvedTarget = path.posix.join(resolvedBase, targetPath).replace(/\\/g, '/');
          // Normalize: remove trailing slash
          aliases.push({ prefix: prefix.replace(/\/$/, ''), target: resolvedTarget.replace(/\/$/, '') });
        }
      }
    } catch (e) { /* skip */ }
  }
  return aliases;
}

function resolveAliasImport(importPath, aliases) {
  for (const alias of aliases) {
    if (importPath === alias.prefix || importPath.startsWith(alias.prefix + '/')) {
      const rest = importPath === alias.prefix ? '' : importPath.slice(alias.prefix.length);
      return (alias.target + rest).replace(/\/$/, '');
    }
  }
  return null;
}

const EXT_PROBES = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.rb', ''];
const INDEX_PROBES = ['/index.ts', '/index.js', '/index.tsx', '/index.jsx', '/__init__.py', ''];
const EXT_PROBES_JS = ['.ts', '.tsx', '.js', '.jsx'];

function tryResolve(importPath, baseDir, allFilesSet, aliases, language) {
  // Try alias resolution first (for TS/JS)
  if (language === 'typescript' || language === 'javascript') {
    const aliasResolved = resolveAliasImport(importPath, aliases);
    if (aliasResolved) {
      // Try the alias-resolved path as if it were relative to project root
      const probes = language === 'typescript' ? ['.ts', '.tsx', '.js', '.jsx'] : ['.js', '.jsx', '.ts', '.tsx'];
      for (const ext of probes) {
        const p = aliasResolved + ext;
        if (allFilesSet.has(p)) return p;
      }
      for (const idx of ['/index.ts', '/index.js', '/index.tsx', '/index.jsx']) {
        const p = aliasResolved + idx;
        if (allFilesSet.has(p)) return p;
      }
    }
  }

  // Relative resolution
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const resolvedBase = path.posix.join(baseDir, importPath);
    return tryResolveWithProbes(resolvedBase, allFilesSet, language);
  }

  // Python absolute resolution
  if (language === 'python') {
    const pp = importPath.replace(/\./g, '/');
    // try a/b/c.py
    if (allFilesSet.has(pp + '.py')) return pp + '.py';
    // try a/b/c/__init__.py
    if (allFilesSet.has(pp + '/__init__.py')) return pp + '/__init__.py';
    return null;
  }

  return null;
}

function tryResolveWithProbes(resolvedBase, allFilesSet, language) {
  if (language === 'typescript' || language === 'javascript') {
    const probes = language === 'typescript' ? EXT_PROBES_JS : ['.js', '.jsx', '.ts', '.tsx'];
    for (const ext of probes) {
      const p = resolvedBase + ext;
      if (allFilesSet.has(p)) return p;
    }
    for (const idx of ['/index.ts', '/index.js', '/index.tsx', '/index.jsx']) {
      const p = resolvedBase + idx;
      if (allFilesSet.has(p)) return p;
    }
  } else if (language === 'python') {
    if (allFilesSet.has(resolvedBase + '.py')) return resolvedBase + '.py';
    if (allFilesSet.has(resolvedBase + '/__init__.py')) return resolvedBase + '/__init__.py';
  } else {
    const probes = { go: '.go', rs: '.rs', rb: '.rb', cpp: '.cpp', c: '.c' };
    const probeExt = probes[language];
    if (probeExt && allFilesSet.has(resolvedBase + probeExt)) return resolvedBase + probeExt;
  }
  return null;
}

function resolveImports(filePath, allFilesSet, aliases) {
  const language = detectLanguage(filePath);
  if (getFileCategory(filePath, language) !== 'code') return [];
  const resolved = new Set();
  const absPath = path.join(PROJECT_ROOT, filePath);
  let content;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch (e) {
    return [];
  }
  const baseDir = path.dirname(filePath);
  const lines = content.split('\n');

  if (language === 'typescript' || language === 'javascript') {
    for (const line of lines) {
      // import ... from '...'
      let m;
      const re1 = /(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      while ((m = re1.exec(line)) !== null) {
        const imp = m[1];
        if (imp.startsWith('./') || imp.startsWith('../') || (aliases.length > 0 && imp.includes('/'))) {
          const r = tryResolve(imp, baseDir, allFilesSet, aliases, language);
          if (r) resolved.add(r);
        }
      }
      // require('...')
      const re2 = /(?:require|require\.resolve)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((m = re2.exec(line)) !== null) {
        const imp = m[1];
        if (imp.startsWith('./') || imp.startsWith('../')) {
          const r = tryResolve(imp, baseDir, allFilesSet, aliases, language);
          if (r) resolved.add(r);
        }
      }
      // dynamic import('...')
      const re3 = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((m = re3.exec(line)) !== null) {
        const imp = m[1];
        if (imp.startsWith('./') || imp.startsWith('../')) {
          const r = tryResolve(imp, baseDir, allFilesSet, aliases, language);
          if (r) resolved.add(r);
        }
      }
    }
  } else if (language === 'python') {
    for (const line of lines) {
      // from .x import y
      let m;
      const reRel = /from\s+(\.[.\w]*)\s+import\s+(.+)/g;
      while ((m = reRel.exec(line)) !== null) {
        const dotPath = m[1];
        const names = m[2].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
        // Count dots to determine depth
        const dots = dotPath.match(/^\.+/)[0].length;
        const modulePath = dotPath.slice(dots).replace(/\./g, '/');
        // Resolve relative to current file's directory
        let relBase = baseDir;
        for (let i = 0; i < dots - 1; i++) {
          relBase = path.posix.dirname(relBase);
        }
        const candidate = relBase ? path.posix.join(relBase, modulePath) : modulePath;
        const r = tryResolve(candidate, baseDir, allFilesSet, [], 'python');
        if (r) resolved.add(r);
        // For each name, try as submodule
        for (const name of names) {
          const subPath = candidate ? path.posix.join(candidate, name) : name;
          const subR = tryResolve(subPath, baseDir, allFilesSet, [], 'python');
          if (subR) resolved.add(subR);
        }
      }
      // from . import x
      const reRel2 = /from\s+(\.+)\s+import\s+(.+)/g;
      while ((m = reRel2.exec(line)) !== null) {
        const dots = m[1].length;
        const names = m[2].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
        let relBase = baseDir;
        for (let i = 0; i < dots - 1; i++) {
          relBase = path.posix.dirname(relBase);
        }
        // "from . import x" means importing x from current package
        // Try relBase/x.py and relBase/x/__init__.py
        for (const name of names) {
          if (!name) continue;
          const subPath = relBase ? path.posix.join(relBase, name) : name;
          const subR = tryResolve(subPath, baseDir, allFilesSet, [], 'python');
          if (subR) resolved.add(subR);
        }
      }
      // Absolute imports: import a.b.c
      const reAbs = /^import\s+([\w.]+)/g;
      while ((m = reAbs.exec(line)) !== null) {
        const imp = m[1];
        const r = tryResolve(imp, '', allFilesSet, [], 'python');
        if (r) resolved.add(r);
      }
      // Absolute imports: from a.b.c import x, y
      const reAbs2 = /from\s+([\w.]+)\s+import\s+(.+)/g;
      while ((m = reAbs2.exec(line)) !== null) {
        const modPath = m[1];
        const names = m[2].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
        const r = tryResolve(modPath, '', allFilesSet, [], 'python');
        if (r) resolved.add(r);
        // If resolved as __init__.py, also try submodules
        if (r && r.endsWith('/__init__.py')) {
          const pkgDir = path.posix.dirname(r);
          for (const name of names) {
            if (!name) continue;
            const subPath = path.posix.join(pkgDir, name);
            const subR = tryResolve(subPath, '', allFilesSet, [], 'python');
            if (subR) resolved.add(subR);
          }
        }
      }
    }
  }

  return [...resolved].sort();
}

// --- Main ---

const PROJECT_ROOT = process.argv[2];
const OUTPUT_PATH = process.argv[3];

if (!PROJECT_ROOT || !OUTPUT_PATH) {
  console.error('Usage: node ua-project-scan.js <PROJECT_ROOT> <OUTPUT_PATH>');
  process.exit(1);
}

if (!fs.existsSync(PROJECT_ROOT)) {
  console.error(`Error: Directory ${PROJECT_ROOT} does not exist`);
  process.exit(1);
}

let allFiles;
try {
  const result = execSync('git ls-files', { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  allFiles = result.trim().split('\n').filter(Boolean);
} catch (e) {
  console.error('Error running git ls-files:', e.stderr || e.message);
  process.exit(1);
}

// Build set of all original files
const originalFilesSet = new Set(allFiles);

// Step 2: Apply hardcoded defaults only → baseline
const igDefaults = ignore();
igDefaults.add(DEFAULT_IGNORE_PATTERNS);
const baselineFiles = allFiles.filter(f => !igDefaults.ignores(f));

// Step 2.5: Create unified filter from @understand-anything/core
const coreDist = '/home/luxor9/.understand-anything/repo/understand-anything-plugin/packages/core/dist';
let createIgnoreFilter;
try {
  // Use dynamic import for ESM module
  const mod = require(path.join(coreDist, 'ignore-filter.js'));
  createIgnoreFilter = mod.createIgnoreFilter;
} catch (e) {
  console.error('Warning: Could not load createIgnoreFilter, falling back to inline filter:', e.message);
  // Fallback: replicate createIgnoreFilter logic
  const ig = ignore();
  ig.add(DEFAULT_IGNORE_PATTERNS);
  const uaIgnorePath = path.join(PROJECT_ROOT, '.understand-anything', '.understandignore');
  if (fs.existsSync(uaIgnorePath)) {
    ig.add(fs.readFileSync(uaIgnorePath, 'utf-8'));
  }
  const rootIgnorePath = path.join(PROJECT_ROOT, '.understandignore');
  if (fs.existsSync(rootIgnorePath)) {
    ig.add(fs.readFileSync(rootIgnorePath, 'utf-8'));
  }
  createIgnoreFilter = () => ({ isIgnored: (p) => ig.ignores(p) });
}

const unifiedFilter = createIgnoreFilter(PROJECT_ROOT);
const filteredFiles = allFiles.filter(f => !unifiedFilter.isIgnored(f));

const filteredByIgnore = baselineFiles.length - filteredFiles.length;

// Use the unified-filtered list going forward
allFiles = filteredFiles;
const allFilesSet = new Set(allFiles);

// --- Process each file ---

// Collect tsconfig aliases for import resolution
const tsAliases = resolveTSAliases(PROJECT_ROOT, allFilesSet);

const files = [];
for (const filePath of allFiles) {
  const language = detectLanguage(filePath);
  const fileCategory = getFileCategory(filePath, language);
  let sizeLines = 0;
  try {
    const absPath = path.join(PROJECT_ROOT, filePath);
    const wcResult = execSync(`wc -l "${absPath.replace(/"/g, '\\"')}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    sizeLines = parseInt(wcResult.trim().split(/\s+/)[0], 10) || 0;
  } catch (e) {
    sizeLines = 0;
  }
  files.push({ path: filePath, language, sizeLines, fileCategory });
}

// Sort by path
files.sort((a, b) => a.path.localeCompare(b.path));

// --- Framework detection ---
const frameworks = detectFrameworks(allFiles, PROJECT_ROOT);

// --- Complexity ---
const totalFiles = files.length;
let estimatedComplexity;
if (totalFiles <= 30) estimatedComplexity = 'small';
else if (totalFiles <= 150) estimatedComplexity = 'moderate';
else if (totalFiles <= 500) estimatedComplexity = 'large';
else estimatedComplexity = 'very-large';

// --- Project name ---
const name = extractProjectName(allFiles, PROJECT_ROOT);

// --- Raw description and readme ---
const rawDescription = getRawDescription(allFiles, PROJECT_ROOT);
const readmeHead = extractReadmeHead(allFiles, PROJECT_ROOT);

// --- Languages ---
const languages = [...new Set(files.map(f => f.language))].sort();

// --- Import resolution ---
const importMap = {};
for (const f of files) {
  importMap[f.path] = f.fileCategory === 'code'
    ? resolveImports(f.path, allFilesSet, tsAliases)
    : [];
}

// --- Output ---
const result = {
  scriptCompleted: true,
  name,
  rawDescription,
  readmeHead,
  languages,
  frameworks,
  files,
  totalFiles,
  filteredByIgnore,
  estimatedComplexity,
  importMap,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
console.error(`Scan complete: ${totalFiles} files written to ${OUTPUT_PATH}`);
process.exit(0);
