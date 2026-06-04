-- Voice Command Audit Logs
CREATE TABLE IF NOT EXISTS public.voice_command_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    audio_s3_key TEXT, -- Path to the raw audio in your S3/Storage vault
    transcript TEXT,
    intent TEXT,
    tool TEXT,
    args JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, executing, completed, failed, pending_confirm, rejected
    requires_confirm BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMPTZ,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_command_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all logs
CREATE POLICY "Admins can view all voice logs" 
ON public.voice_command_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Users can see their own logs
CREATE POLICY "Users can view their own voice logs" 
ON public.voice_command_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Voice System Configuration Table
CREATE TABLE IF NOT EXISTS public.voice_system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enabled BOOLEAN DEFAULT true,
    kill_switch_active BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default config
INSERT INTO public.voice_system_config (enabled) VALUES (true) ON CONFLICT DO NOTHING;

-- Tool Registry Table (to toggle tools live)
CREATE TABLE IF NOT EXISTS public.voice_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    risk_level VARCHAR(20) DEFAULT 'low', -- low, med, high
    enabled BOOLEAN DEFAULT true,
    required_role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed some initial tools
INSERT INTO public.voice_tools (name, description, risk_level) VALUES
('status_query', 'Query the status of a specific case', 'low'),
('generate_report', 'Generate an Excel/PDF report for a period', 'low'),
('assign_field_exec', 'Assign a field executive to a case', 'med'),
('process_challan', 'Trigger RPA to process a GRAS challan', 'high'),
('send_whatsapp_update', 'Send a manual WhatsApp update to a client', 'high')
ON CONFLICT (name) DO NOTHING;
