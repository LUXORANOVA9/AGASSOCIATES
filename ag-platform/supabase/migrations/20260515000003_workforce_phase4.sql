-- Phase 4 — rate limits, anomaly tracking, audio replay scaffolding.

-- 1. Per-capability hard cap for sliding-window rate limiting.
ALTER TABLE capability
    ADD COLUMN IF NOT EXISTS per_hour_limit INTEGER;

-- Sensible defaults; admins can tune via the workforce API.
UPDATE capability SET per_hour_limit = 30  WHERE risk = 'low'  AND per_hour_limit IS NULL;
UPDATE capability SET per_hour_limit = 12  WHERE risk = 'med'  AND per_hour_limit IS NULL;
UPDATE capability SET per_hour_limit = 4   WHERE risk = 'high' AND per_hour_limit IS NULL;

-- 2. Helper view: anomaly score — denials + errors per staff in the last 10 min.
CREATE OR REPLACE VIEW staff_anomaly_window AS
SELECT
    staff_id,
    COUNT(*) FILTER (WHERE status IN ('error', 'warn')) AS bad_events,
    COUNT(*) AS total_events,
    MAX(occurred_at) AS last_event
FROM staff_activity
WHERE occurred_at > now() - interval '10 minutes'
  AND staff_id IS NOT NULL
GROUP BY staff_id;

-- 3. Index hint for the case-timeline endpoint.
CREATE INDEX IF NOT EXISTS idx_staff_activity_case_time
    ON staff_activity(case_id, occurred_at DESC)
    WHERE case_id IS NOT NULL;
