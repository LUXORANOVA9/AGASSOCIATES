-- Setup Token incrementing safely
CREATE OR REPLACE FUNCTION increment_org_tokens(org_id UUID, amount BIGINT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations
  SET ai_tokens_used = ai_tokens_used + amount
  WHERE id = org_id;
END;
$$;
