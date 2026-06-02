# ADR 0002: NOI State Machine with Transition Validation

## Status

Accepted

## Context

The NOI (Notice of Intimation) workflow has a complex lifecycle spanning 9 linear states plus 2 exception states, with one branching path (RECTIFY). Before this ADR, the state machine was defined only as a flat list (`NOI_STATES`) with no transition validation. Several issues existed:

- **RECTIFY** was described in the docstring but missing from `NOI_STATES`, making it unreachable through code
- **COMPLETED** was defined but never set by any code path — dead terminal state
- **No transition guards** — `update_noi_status()` accepted any target status from any current status, allowing invalid transitions like `DOCUMENTS_RECEIVED → COMPLETED` in one hop
- The webhook handler (`main.py:631`) incorrectly called `acknowledge()` when `CHALLAN_PAID` was received, short-circuiting the entire downstream workflow
- `file_noi()` accepted `CHALLAN_PAID` and `VERIFIED` as valid entry points, bypassing the bank's `NOI_DROP_RECEIVED` go-ahead — a real business risk
- External webhooks from GRAS payment gateway and bank systems need to update status without going through application-level transition validation

## Decision

1. **Explicit transition map**: Replace the flat `NOI_STATES` list with a `NOI_TRANSITIONS` dict mapping each state to its valid successors. `RECTIFY` is added as a first-class state branching from `NOI_DROP_RECEIVED`, rejoining at `NOI_FILED`.

2. **Application-layer validation**: `update_noi_status()` validates transitions against `NOI_TRANSITIONS` unless `force=True` is passed. Internal workflow steps (generate_challan → update_noi_status(CHALLAN_GENERATED)) validate. External webhooks force-skip validation because they reflect real-world events that can arrive out of order.

3. **COMPLETED auto-transition**: `acknowledge()` now transitions `ACKNOWLEDGED → COMPLETED` as the final step, making `COMPLETED` reachable.

4. **Stricter file_noi guard**: Only accepts `NOI_DROP_RECEIVED` or `RECTIFY` as entry points — the bank must have given the go-ahead before filing.

5. **Webhook webhook fixed**: `CHALLAN_PAID` no longer triggers `acknowledge()`. The webhook only updates status — downstream actions wait for proper workflow steps.

### Why not a database-level state machine?

Postgres CHECK constraints or ENUM-based transitions would be more robust but require:
- Complex trigger functions for transition validation
- Schema changes per state addition
- No easy way to bypass for external webhooks

The Python-level approach gives us flexibility for webhooks while catching programming errors in internal workflow code.

## Consequences

### Positive
- Invalid transitions are caught early with clear error messages
- `RECTIFY` is now a real, reachable state
- `COMPLETED` is auto-reached after acknowledgment
- Business-critical `file_noi` guard matches the real process (bank go-ahead required)
- Webhook handler no longer short-circuits the workflow

### Negative
- Transition logic lives in application code, not the database — a separate deployment is needed to change state machines
- `force=True` bypass means webhook payloads must be trusted (validated upstream)
- Two code paths (validated vs forced) increase testing surface

### Risks
- If webhooks consistently arrive out of order, the `force=True` path becomes the de facto standard, defeating the purpose of validation
- New states require updating `NOI_TRANSITIONS`, `NOI_TEMPLATES` in `auto_comms.py`, and the webhook `valid_statuses` list in `main.py` — three touch points
