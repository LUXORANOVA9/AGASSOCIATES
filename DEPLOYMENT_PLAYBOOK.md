# AG Associates Zero-Staff SaaS: Deployment Playbook

Congratulations on completing the 72-hour SaaS Sprint! The platform is feature-complete. Follow this playbook to take the platform from local development into live production.

## 1. Database & Authentication (Supabase)
The backbone of the multitenant architecture.
- [ ] Create a new production project on [Supabase](https://supabase.com).
- [ ] Go to the SQL Editor and run `ag-platform/src/server/migrations.sql` to generate the `organizations`, `cases`, `profiles`, and `timesheets` tables.
- [ ] Go to **Database -> Extensions** and enable `vector` (pgvector) if not enabled by default.
- [ ] Go to **Authentication -> Providers** and configure your allowed sign-in methods (Email/Password, Google, etc.).
- [ ] Copy your `Project URL` and `anon public` keys.

## 2. AI Backend (Google Cloud Run / Render)
Deploy the Python FastAPI container that hosts the 6 Agents.
- [ ] Create a production `.env` file containing:
  ```env
  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
  SUPABASE_JWT_SECRET=[YOUR_JWT_SECRET_FROM_SUPABASE]
  LLM_BASE_URL=https://api.groq.com/openai/v1  # Or Gemini/vLLM URL
  LLM_MODEL_NAME=llama3-8b-8192 # Or your preferred model
  CORS_ALLOWED_ORIGINS=https://ag-associates.com
  ```
- [ ] **Google Cloud Run** (Recommended for G-Stack): 
  1. Build the Docker image: `docker build -t gcr.io/[PROJECT_ID]/ag-ai-backend ./ag-associates-ai`
  2. Push and Deploy to Cloud Run, exposing port `8001`.
- [ ] **Alternative (Render)**: Connect your GitHub repo, point to `ag-associates-ai`, and set the start command to `uvicorn main:app --host 0.0.0.0 --port $PORT`.

## 3. Frontend Platform (Vercel / Cloudflare Pages)
Deploy the client-facing UI and Field Executive PWA.
- [ ] In your frontend `.env`, add:
  ```env
  VITE_SUPABASE_URL=[YOUR_PROJECT_URL]
  VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
  VITE_AI_API_URL=https://[YOUR_BACKEND_URL]/api
  ```
- [ ] Connect the `ag-platform` directory to **Vercel** or **Cloudflare Pages**.
- [ ] Ensure the Build Command is `npm run build` and Output Directory is `dist`.

## 4. Orchestration (n8n)
For WhatsApp triggers and external system polling.
- [ ] Deploy n8n via Docker or use n8n Cloud.
- [ ] Import your workflow JSON files.
- [ ] Update the HTTP Request nodes in n8n to point to your live AI Backend URL (e.g., `https://[YOUR_BACKEND_URL]/api/generate-agreement`).

## 5. Pre-Flight Checks
- [ ] **Test the JWT Bridge**: Log into the production frontend, verify you get a Supabase Token, and ensure it successfully authenticates against the AI backend.
- [ ] **Test the Field App**: Open the deployed site on a mobile device, toggle Airplane Mode, take a picture, and reconnect to verify the Offline Queue syncs successfully.
- [ ] **Verify Webhooks**: Send a test WhatsApp message to your business number and verify n8n triggers the Aisha agent.

## Future Phase: NeSL Integration
Once you acquire your official Government NeSL API Keys and Corporate DSCs:
1. Update `/api/nesl/execute` in `main.py` with the official XML/JSON SOAP payloads.
2. Store the DSC keys securely in Google Cloud Secret Manager.
