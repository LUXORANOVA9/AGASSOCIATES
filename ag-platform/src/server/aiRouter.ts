import { Router } from "express";
import { streamText, generateText, generateObject, embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to track AI credits (Tokens)
async function checkAndTrackTokens(orgId: string, tokensToConsume: number = 0) {
  // Simplistic token tracking
  if (!orgId) return;

  const { data: org, error } = await supabase
    .from("organizations")
    .select("ai_tokens_used, ai_tokens_limit")
    .eq("id", orgId)
    .single();

  if (error || !org) return;

  if (org.ai_tokens_used >= org.ai_tokens_limit) {
    throw new Error("AI Quota Exceeded");
  }

  if (tokensToConsume > 0) {
    await supabase.rpc('increment_org_tokens', {
      org_id: orgId,
      amount: tokensToConsume
    });
  }
}

// 1. PROJECT BRIEF GENERATOR (Stream)
router.post("/generate-brief", async (req, res) => {
  try {
    const { project_name, client_name, scope_description, deliverables, orgId } = req.body;
    
    await checkAndTrackTokens(orgId); // Basic quota check

    const systemPrompt = `You are a senior consultant writing professional project briefs. 
Structure the output using Markdown with the following sections exactly:
- Executive Summary
- Scope
- Deliverables
- Timeline
- Risks`;

    const prompt = `Project Name: ${project_name}
Client Name: ${client_name}
Scope Description: ${scope_description}
Deliverables: ${deliverables ? deliverables.join(', ') : 'Not specified'}`;

    const result = await streamText({
      model: google("gemini-3.1-pro-preview"),
      system: systemPrompt,
      prompt: prompt,
    });

    // Pipe directly to Express response
    result.pipeTextStreamToResponse(res);
  } catch (err: any) {
    console.error(err);
    if (err.message === "AI Quota Exceeded") {
       res.status(402).json({ error: "AI Quota Exceeded" });
    } else {
       res.status(500).json({ error: "Failed to generate brief" });
    }
  }
});

// 2. SMART TASK SUGGESTIONS
router.post("/suggest-tasks", async (req, res) => {
  try {
    const { brief, existingTasks, orgId } = req.body;
    await checkAndTrackTokens(orgId);

    const result = await generateObject({
      model: google("gemini-3.1-pro-preview"),
      system: "You are an expert project manager. Based on the provided project brief and any existing tasks, suggest an array of new detailed tasks.",
      prompt: `Brief:\n${brief}\n\nExisting Tasks:\n${JSON.stringify(existingTasks)}`,
      schema: z.object({
        tasks: z.array(z.object({
          title: z.string(),
          description: z.string(),
          status: z.enum(["To Do", "In Progress", "Review", "Done"]).default("To Do"),
          priority: z.enum(["Low", "Medium", "High"]),
          estimatedHours: z.number()
        }))
      })
    });

    res.json({ tasks: result.object.tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CLIENT COMMUNICATION DRAFTING
router.post("/draft-email", async (req, res) => {
  try {
    const { email_type, context_data, orgId } = req.body;
    await checkAndTrackTokens(orgId);

    const result = await generateText({
      model: google("gemini-3.1-pro-preview"),
      system: "You are an elite client relations manager. Write a professional email draft based on the provided context.",
      prompt: `Type: ${email_type}\nContext: ${JSON.stringify(context_data)}`
    });

    res.json({ draft: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resend dispatch logic
router.post("/send-email", async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'AgAssociates <noreply@resend.dev>', // requires verified domain in prod
      to: [to],
      subject: subject,
      html: body.replace(/\n/g, '<br/>')
    });

    if (error) {
      return res.status(400).json({ error });
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. INVOICE DESCRIPTION GENERATOR
router.post("/invoice-line-item", async (req, res) => {
  try {
    const { time_entries, project_name, orgId } = req.body;
    await checkAndTrackTokens(orgId);

    const result = await generateObject({
      model: google("gemini-3.1-pro-preview"),
      system: "Create succinct, professional invoice line item descriptions consolidating these time entries.",
      prompt: `Project: ${project_name}\Entries: ${JSON.stringify(time_entries)}`,
      schema: z.object({
        lineItems: z.array(z.object({
          description: z.string(),
          totalHours: z.number(),
          suggestedRate: z.number().optional()
        }))
      })
    });

    res.json({ lineItems: result.object.lineItems });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DOCUMENT SUMMARIZER
router.post("/summarize-document", async (req, res) => {
  try {
    const { extracted_text, orgId } = req.body;
    await checkAndTrackTokens(orgId);

    const result = await generateObject({
      model: google("gemini-3.1-pro-preview"),
      system: "You are a fast, precise business analyst. Summarize the document.",
      prompt: extracted_text,
      schema: z.object({
        summaryParagraph: z.string(),
        keyPoints: z.array(z.string()),
        actionItems: z.array(z.string())
      })
    });

    res.json({ summary: result.object });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. SEMANTIC PROJECT SEARCH
// Note: To ingest a project, we would compute its embedding when it is created.
// Here we provide the search route and an ingest route.
router.post("/search-projects", async (req, res) => {
  try {
    const { query, orgId } = req.body;
    
    // Create query embedding
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: query,
    });

    // Execute semantic search query in supabase
    const { data: matchedProjects, error } = await supabase.rpc('match_projects', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
      org_id: orgId
    });

    if (error) throw error;

    res.json({ results: matchedProjects });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ingest-project", async (req, res) => {
  try {
    const { projectId, content, orgId } = req.body;
    await checkAndTrackTokens(orgId); // Account for ingestion
    
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: content,
    });

    const { error } = await supabase.from('project_embeddings').insert({
      project_id: projectId,
      content,
      embedding
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. LEGAL DOCUMENT VETTING
router.post("/vet-document", async (req, res) => {
  try {
    const { documentText, documentType, orgId } = req.body;
    
    await checkAndTrackTokens(orgId); // Account for tokens

    if (!documentText) {
      return res.status(400).json({ error: 'Document text is required' });
    }

    const systemPrompt = "You are a legal document vetting assistant for an Indian home loan origination firm. Analyze documents for missing details, discrepancies, or potential issues preventing a home loan approval.";
    const prompt = `Please analyze the following extracted text from a ${documentType || 'document'}.
Be concise and return your analysis.

Document Text:
${documentText}`;

    const result = await generateObject({
      model: google("gemini-3.1-pro-preview"),
      system: systemPrompt,
      prompt: prompt,
      schema: z.object({
        status: z.enum(["APPROVED", "NEEDS_MANUAL_REVIEW", "REJECTED"]),
        feedback: z.string().describe("A short string describing missing details, discrepancies, or issues."),
        risks: z.array(z.string()).describe("A list of specific risks identified in the document.")
      })
    });

    res.json(result.object);
  } catch (error: any) {
    console.error('AI Vetting error:', error);
    res.status(500).json({ error: 'Failed to vet document using AI' });
  }
});

export default router;
