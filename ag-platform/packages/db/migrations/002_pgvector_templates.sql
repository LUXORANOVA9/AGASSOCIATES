-- 002_pgvector_templates.sql
-- Adds pgvector legal templates table for the AI rental agreement pipeline.
-- Dimension is 384 to match sentence-transformers/all-MiniLM-L6-v2.
-- If you change the embedding model, update vector(384) and re-run generate_embeddings.py.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS legal_templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    template_type VARCHAR(100),
    jurisdiction VARCHAR(100),
    language VARCHAR(50) DEFAULT 'en',
    embedding vector(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS legal_templates_embedding_idx
ON legal_templates USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

INSERT INTO legal_templates (title, content, template_type, jurisdiction, language, embedding) VALUES
(
    'Maharashtra Residential Rent Agreement - English',
    'THIS RENT AGREEMENT made on this __ day of __, 20__ between __, son/daughter of __, residing at __, hereinafter called the "LANDLORD" of the ONE PART and __, son/daughter of __, residing at __, hereinafter called the "TENANT" of the OTHER PART. WHEREAS the LANDLORD is the absolute owner of the property described in the Schedule hereunder. AND WHEREAS the TENANT has approached the LANDLORD to grant him/her a license to use the said premises for residential purpose. NOW THIS DEED WITNESSETH AS FOLLOWS: 1. The landlord hereby grants to the tenant a license to use the said premises for residential purpose only. 2. The period of license shall be for 11 months commencing from __. 3. The monthly license fee shall be Rs. __ payable on or before 7th day of each month.',
    'rent_agreement',
    'Maharashtra',
    'en',
    NULL
),
(
    'Maharashtra Commercial Rent Agreement - Marathi',
    'हे भाडेकरारनामे दिनांक __ रोजी __ आणि __ यांच्यात करण्यात आले आहे. मालकाने आपल्या मालकीच्या इमारतीचे वर्णन खालीलप्रमाणे केले आहे. भाडेकरार कालावधी ११ महिन्यांचा असेल. मासिक भाडे रुपये __ असेल. हे भाडे दर महिन्याच्या ७ तारखेपूर्वी भरणे बंधनकारक असेल.',
    'rent_agreement',
    'Maharashtra',
    'mr',
    NULL
),
(
    'Maharashtra Rent Agreement - Hindi',
    'यह किराया समझौता दिनांक __ को __ और __ के बीच किया गया है। मालक अपने परिसर का वर्णन निम्नलिखित रूप से करता है। किराया अवधि 11 महीने की होगी। मासिक किराया रुपये __ होगा। यह किराया प्रत्येक महीने की 7 तारीख से पहले भुगतान किया जाना चाहिए।',
    'rent_agreement',
    'Maharashtra',
    'hi',
    NULL
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_legal_templates_updated_at
    BEFORE UPDATE ON legal_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
