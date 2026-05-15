# Git & Version Control Guidelines

**Git is not just a backup system — it's a communication tool.** Clean git history enables fast debugging (`git bisect`), clear attribution, and safe reverts. This standard enforces atomic commits, meaningful messages, and trunk-based development.

## When to Use
- Before making any commit
- When reviewing a PR's git history
- When setting up a new project

---

## Process

### Step 1: Atomic Commits
Each commit should represent **ONE logical change** — not a day's worth of work.
- A commit should be: independently deployable, independently revertable.
- Never commit "WIP" or partial implementations.
- **Verify**: You could revert this commit without affecting adjacent functionality.

### Step 2: Commit Message Format
Follow **Conventional Commits**:
```text
type(scope): short summary (max 72 chars)

Body: what changed and WHY (not how — the diff shows how).

Closes: #issue-number
```
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- The summary is in the imperative mood: "Add feature" not "Added feature"
- **Verify**: Message passes: `feat|fix|docs|...(<scope>): <summary>` format.

### Step 3: Trunk-Based Development
- Work directly on `main` for small changes (<1 day of work).
- For larger features: short-lived feature branches (max 2 days), frequent merges to `main`.
- Never let a branch live more than 3 days without merging or rebasing.
- Use feature flags for incomplete features, not long-lived branches.
- **Verify**: No branch is more than 2 days old without a merge/rebase plan.

### Step 4: Pre-Commit Gates
- Before every commit: tests pass, linter passes, no secrets in diff.
- Use pre-commit hooks to enforce automatically.

---

## Common Rationalizations (and Rebuttals)

| Excuse | Rebuttal |
|--------|----------|
| "I'll clean up the commits later" | You won't. Clean as you go. |
| "The commit message doesn't matter" | It matters in 6 months when you're bisecting a production bug. |
| "Feature branches protect main" | Long-lived branches cause merge nightmares. Trunk-based is safer. |

---

## Verification Checklist
- [ ] Commits are atomic and independently deployable
- [ ] Commit messages follow Conventional Commits format
- [ ] No long-lived branches (> 3 days)
- [ ] Pre-commit hooks in place

## References
- ci-cd-pipelines skill
- Conventional Commits
