# Contributing to AG Associates

Thank you for your interest in contributing! This guide will help you get started.

## 🏗 Development Setup

### Prerequisites
- Git
- Python 3.10+ (AI pipeline)
- Node.js 18+ (platform frontend)
- Docker & Docker Compose

### Clone & Configure

```bash
git clone https://github.com/LUXORANOVA9/AGASSOCIATES.git
cd AGASSOCIATES
```

See the [Quick Start](./README.md#-quick-start) section in the README for setup instructions.

## 📏 Code Standards

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add bank portal filtering by case type
fix: resolve pgvector dimension mismatch
docs: update API endpoint documentation
refactor: extract embedding logic to shared module
```

### Branch Naming

```
feat/case-state-machine
fix/connection-leak-templates
docs/update-architecture
```

### Python (Backend)

- Use type hints everywhere
- Follow PEP 8
- Use `try/finally` for database connections
- Import from `config.py` — never hardcode env values

### TypeScript (Platform)

- Strict mode enabled
- Use interfaces from `packages/types/`
- Components in `packages/ui/` must be reusable

## 🔍 Before Submitting a PR

1. **Read [`CLAUDE.md`](./CLAUDE.md)** — Contains architecture overview, conventions, and known gotchas
2. **Test locally** — Ensure your changes work end-to-end
3. **No dead imports** — Remove any unused imports
4. **Connection safety** — All DB endpoints must use `try/finally` with null-safe close
5. **Update docs** — If you change APIs or configuration, update the relevant README

## 🐛 Reporting Issues

Use [GitHub Issues](https://github.com/LUXORANOVA9/AGASSOCIATES/issues) for bug reports. Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Python/Node version, Docker version)

## 🔒 Security

For security vulnerabilities, **do not open a public issue**. See [SECURITY.md](./SECURITY.md) for responsible disclosure.

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's existing license.
