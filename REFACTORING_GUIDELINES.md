# Refactoring Guidelines

**Category**: refactoring  
**Applies to**: claude, gemini, cursor, copilot, any  
**Version**: 1.0.0  

**Overview**
Refactoring changes the internal structure of code without changing its external behavior. The keyword is "without" — if behavior changes, it's not refactoring, it's modification. This skill enforces safe refactoring with tests as the safety net.

## When to Use
- When code is hard to understand or extend
- When duplication makes maintenance risky
- Before adding a feature to a messy area of code
- **Never**: "while also adding feature X" — refactor separately

---

## Process

### Step 1: Establish a Safety Net
Before touching a single line: ensure there are tests covering the code to be refactored.
- If tests are missing: add characterization tests first. These capture current behavior, not desired behavior.
- Run the tests. They should all pass. This is your baseline.
- **Verify**: Tests pass. They cover the code being refactored.

### Step 2: Refactor in Micro-Steps
Make the smallest meaningful change.
- Run tests after EVERY change — not after 10 changes.
- If tests break: revert immediately and take a smaller step.
- Never batch multiple refactoring changes together.
- **Verify**: Tests pass after every individual change.

### Step 3: One Thing at a Time
Refactoring types cannot be mixed in one step:
- Extract method → separate commit
- Rename → separate commit
- Move → separate commit
- "Refactor and also fix this" is not refactoring — it's two PRs.
- **Verify**: This commit does exactly one type of refactoring.

### Step 4: Verify No Behavior Change
Run the full test suite.
- If integration/E2E tests exist: run them too.
- Compare external API responses before and after (if applicable).
- **Verify**: All tests pass. No observable behavior change.

---

## Common Rationalizations (and Rebuttals)

| Excuse | Rebuttal |
|--------|----------|
| "I'll add tests after refactoring" | You can't verify a behavior-preserving refactor without tests before the refactor. |
| "This change is obviously safe" | Obvious safety is how production incidents happen. Run the tests. |
| "I'll just do a quick cleanup" | "Quick cleanup" that changes behavior is a bug, not a refactor. |

---

## Verification Checklist
- [ ] Tests existed before any code was changed
- [ ] Tests run after every individual change
- [ ] Only one type of refactoring per commit
- [ ] Full test suite passes at the end
- [ ] No behavior change observable externally
