-- Vyasa Voice Control — append-only audit log for the voice automation system.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE voice_command_status AS ENUM (
        'unrouted',
        'pending_confirm',
        'executed',
        'denied',
        'tool_error'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE voice_command_risk AS ENUM ('none', 'low', 'med', 'high', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS voice_command_logs (
    id              UUID PRIMARY KEY,
    user_id         TEXT,
    transcript      TEXT NOT NULL,
    detected_language TEXT,
    tool_name       TEXT,
    tool_args       JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk            voice_command_risk NOT NULL DEFAULT 'unknown',
    status          voice_command_status NOT NULL,
    result          JSONB NOT NULL DEFAULT '{}'::jsonb,
    audio_s3_key    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_command_logs_user_created
    ON voice_command_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_command_logs_status
    ON voice_command_logs(status);

-- RLS: only the originating admin (or service role) reads their own commands.
ALTER TABLE voice_command_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voice command self-read"
    ON voice_command_logs
    FOR SELECT
    USING (user_id = auth.uid()::text);
