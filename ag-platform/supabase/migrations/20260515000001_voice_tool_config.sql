-- Per-tool RBAC for the Vyasa Voice Console.
-- Missing row = use the in-process registry default + allow everyone.

CREATE TABLE IF NOT EXISTS voice_tool_config (
    tool_name      TEXT PRIMARY KEY,
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    risk_override  TEXT,                              -- 'low' | 'med' | 'high'
    allowed_roles  TEXT[]  NOT NULL DEFAULT '{}',     -- empty = no role restriction
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE voice_tool_config ENABLE ROW LEVEL SECURITY;

-- Read open to authenticated users; writes restricted to service-role via
-- backend API (the API gates this with the X-Voice-Admin-Key header).
CREATE POLICY "voice_tool_config_read"
    ON voice_tool_config FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
