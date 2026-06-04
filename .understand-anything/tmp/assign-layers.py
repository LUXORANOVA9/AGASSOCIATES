import json, sys, re

with open('/home/luxor9/AGASSOCIATES/.understand-anything/tmp/ua-arch-results.json') as f:
    arch = json.load(f)

with open('/home/luxor9/AGASSOCIATES/.understand-anything/tmp/ua-arch-input.json') as f:
    inp = json.load(f)

all_nodes = inp['fileNodes']
all_node_ids = [n['id'] for n in all_nodes]
total = len(all_node_ids)

# Build node lookup
node_map = {n['id']: n for n in all_nodes}

# Get filePath for each node (derive from ID if missing)
def get_fp(node_id):
    node = node_map.get(node_id, {})
    if node.get('filePath'):
        return node['filePath']
    # Derive from ID: type:path:entity -> path is between first and last colon, or after first colon
    parts = node_id.split(':')
    if len(parts) >= 3:
        # type:path:entity or type:path:entity:nested
        return ':'.join(parts[1:-1])
    elif len(parts) == 2:
        return parts[1]
    return ''

# Read directory groups from arch results
dir_groups = arch['directoryGroups']
node_to_group = {}
for g, ids in dir_groups.items():
    for nid in ids:
        node_to_group[nid] = g

# Pattern to layer mapping
pattern_to_layer = {
    'api': 'layer:api',
    'service': 'layer:service',
    'data': 'layer:data',
    'types': 'layer:data',
    'ui': 'layer:ui',
    'hooks': 'layer:client-logic',
    'state': 'layer:client-logic',
    'utility': 'layer:client-logic',
    'assets': 'layer:ui',
    'ci-cd': 'layer:infrastructure',
    'infrastructure': 'layer:infrastructure',
    'documentation': 'layer:documentation',
    'config': 'layer:config',
}

layer_names = {
    'layer:api': 'API Layer',
    'layer:service': 'Service Layer',
    'layer:data': 'Data Layer',
    'layer:ui': 'UI Layer',
    'layer:client-logic': 'Client Logic Layer',
    'layer:infrastructure': 'Infrastructure Layer',
    'layer:documentation': 'Documentation Layer',
    'layer:config': 'Configuration Layer',
}

layer_descs = {
    'layer:api': 'FastAPI REST endpoints, Express webhooks, route handlers, and request/response processing for the legal ops platform',
    'layer:service': 'AI agents (Aisha/auditor/bouncer), RPA browser automation, NOI pipeline, payment processing, background tasks, and core business logic',
    'layer:data': 'Supabase/PostgreSQL migrations, SQL schema definitions, Pydantic ORM models, and TypeScript domain type definitions',
    'layer:ui': 'Next.js app router pages, React Native mobile screens, shared UI components, app shells, layout wrappers, and NOI dashboard prototype',
    'layer:client-logic': 'Custom React hooks, Zustand stores, API client modules, React Native lib utilities, and shared frontend helper functions',
    'layer:infrastructure': 'Docker multi-stage builds, docker-compose orchestration, Caddy reverse proxy, GitHub Actions CI/CD, and VPS provisioning scripts',
    'layer:documentation': 'Project READMEs, domain glossary (CONTEXT.md), architecture ADRs, development guidelines, and deployment runbooks',
    'layer:config': 'TypeScript/ESLint/Prettier configs, package.json manifests, Turborepo pipeline definitions, environment templates, and build tooling',
}

layers = {k: {'id': k, 'name': layer_names[k], 'description': layer_descs[k], 'nodeIds': []} for k in layer_names}

def assign(nid, layer_id):
    layers[layer_id]['nodeIds'].append(nid)

# Process each node
for nid in all_node_ids:
    group = node_to_group.get(nid, 'unknown')
    fp = get_fp(nid)
    nd = node_map.get(nid, {})
    ntype = nd.get('type', 'file')
    tags = nd.get('tags', [])
    name = nd.get('name', '')

    # Rule 1: service type and Dockerfile -> infrastructure
    if ntype == 'service' and ('Dockerfile' in fp or 'Dockerfile' in name or 'docker-compose' in fp):
        assign(nid, 'layer:infrastructure')
        continue

    # Rule 2: table type -> data
    if ntype == 'table':
        assign(nid, 'layer:data')
        continue

    # Rule 3: pipeline type -> infrastructure
    if ntype == 'pipeline':
        assign(nid, 'layer:infrastructure')
        continue

    # Rule 4: document type -> documentation (unless it's co-located with code)
    if ntype == 'document':
        # All docs go to documentation layer
        assign(nid, 'layer:documentation')
        continue

    # Rule 5: service type (non-Dockerfile) -> if infra pattern, infra; else service
    if ntype == 'service':
        if 'Caddyfile' in name or 'Caddyfile' in fp:
            assign(nid, 'layer:infrastructure')
            continue
        assign(nid, 'layer:service')
        continue

    # Rule 6: config type -> config (unless Docker)
    if ntype == 'config':
        if 'docker-compose' in fp or 'Caddyfile' in fp:
            assign(nid, 'layer:infrastructure')
            continue
        assign(nid, 'layer:config')
        continue

    # Now handle file type nodes using directory group patterns
    pat = arch['patternMatches'].get(group, 'unknown')

    # Groups needing special handling
    if group == 'root':
        # mix of config-level files
        assign(nid, 'layer:config')
    elif group == 'root-config':
        if 'docker-compose' in fp:
            assign(nid, 'layer:infrastructure')
        else:
            assign(nid, 'layer:config')
    elif group == 'ag-platform-root':
        if 'Dockerfile' in fp:
            assign(nid, 'layer:infrastructure')
        elif name in ('index.html', 'server.ts'):
            assign(nid, 'layer:ui')
        else:
            assign(nid, 'layer:config')
    elif group == 'ag-platform-mobile':
        if name in ('global.css',):
            assign(nid, 'layer:ui')
        else:
            assign(nid, 'layer:config')
    elif group == 'infra-root':
        assign(nid, 'layer:infrastructure')
    elif group == '.github':
        assign(nid, 'layer:infrastructure')
    elif pat in pattern_to_layer:
        assign(nid, pattern_to_layer[pat])
    else:
        # Fallback: by tags
        if 'infrastructure' in tags or 'containerization' in tags:
            assign(nid, 'layer:infrastructure')
        elif 'documentation' in tags:
            assign(nid, 'layer:documentation')
        elif 'configuration' in tags:
            assign(nid, 'layer:config')
        elif 'ui' in tags or 'component' in tags or 'page' in tags or 'screen' in tags:
            assign(nid, 'layer:ui')
        elif 'api-handler' in tags or 'routing' in tags:
            assign(nid, 'layer:api')
        elif 'service' in tags or 'agent' in tags or 'workflow' in tags:
            assign(nid, 'layer:service')
        elif 'database' in tags or 'data-model' in tags or 'type-definition' in tags:
            assign(nid, 'layer:data')
        else:
            assign(nid, 'layer:config')

# Verify
total_assigned = sum(len(l['nodeIds']) for l in layers.values())
if total_assigned != total:
    print(f"ERROR: Mismatch - assigned {total_assigned} but expected {total}", file=sys.stderr)
    # Find unassigned
    assigned_set = set()
    for l in layers.values():
        assigned_set.update(l['nodeIds'])
    missing = set(all_node_ids) - assigned_set
    extra = assigned_set - set(all_node_ids)
    if missing:
        print(f"  Missing {len(missing)} nodes:", file=sys.stderr)
        for m in list(missing)[:5]:
            print(f"    {m}", file=sys.stderr)
    if extra:
        print(f"  Extra {len(extra)} nodes:", file=sys.stderr)
    sys.exit(1)

final_layers = [l for l in layers.values() if l['nodeIds']]
assert len(final_layers) <= 10, f"Too many layers: {len(final_layers)}"

output_path = '/home/luxor9/AGASSOCIATES/.understand-anything/intermediate/layers.json'
with open(output_path, 'w') as f:
    json.dump(final_layers, f, indent=2)

print(f"Wrote {len(final_layers)} layers, {total_assigned} nodes")
for l in final_layers:
    print(f"  {l['id']}: {len(l['nodeIds'])} nodes")
