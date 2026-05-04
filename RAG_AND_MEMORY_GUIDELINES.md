# RAG and Memory Systems Guidelines

**Category**: architecture, ai  
**Applies to**: claude, gemini, cursor, copilot, any  
**Version**: 1.0.0  

**Overview**
RAG (Retrieval-Augmented Generation) and memory systems are how AI agents work with knowledge that exceeds their context window. Done well: agents give accurate, grounded answers. Done poorly: context overflow, hallucination from stale retrieval, and performance degradation.

This skill covers the design principles and failure modes of RAG and memory architectures for production AI systems.

## When to Use
- Building any AI system that needs to access external knowledge
- When agent context windows are being exceeded
- When agents need to remember information across sessions
- When building Q&A, document analysis, or knowledge base systems

---

## Process

### Step 1: Choose the Right Memory Architecture
Identify what the agent needs to remember:
- **Ephemeral**: Within a single session (use in-context memory)
- **Session-persistent**: Across a user's sessions (use external key-value store)
- **Knowledge base**: Organizational or domain knowledge (use vector DB + RAG)
- **Procedural**: How to do tasks (encode in SKILL.md / system prompt)

| Memory Type | Recommended Store |
|-------------|-------------------|
| In-session facts | Context window (summarized) |
| User preferences | Key-value store (Redis, DynamoDB) |
| Document corpus | Vector database (Pinecone, Weaviate, pgvector) |
| Long-term facts | Structured DB + caching |

- **Verify**: Each type of information the agent needs has a defined storage mechanism.

### Step 2: Design the RAG Pipeline
- **Chunking strategy**: Break documents into chunks at semantic boundaries (paragraphs, sections) — not arbitrary character counts.
- **Embedding model**: Match the embedding model to your query type. Use the same model for indexing and retrieval.
- **Retrieval**: Retrieve top-K most semantically similar chunks. K = 3–7 is usually optimal.
- **Re-ranking**: After retrieval, re-rank by relevance using a cross-encoder. Top K becomes top 3–5 for the prompt.
- **Context injection**: Inject retrieved chunks into the prompt with clear source citations.
- **Verify**: Retrieved chunks are genuinely relevant to the query before injecting into context.

### Step 3: Prevent Context Bloat
- **Summarize, don't accumulate**: For long sessions, summarize previous turns rather than appending them indefinitely.
- **Retrieve, don't pre-load**: Only load context relevant to the current query. Don't pre-load everything.
- **Set context budgets**: Define maximum token allocations for: system prompt, retrieved context, conversation history, user message.
- **Compress before injecting**: Summarize long retrieved documents to extract the relevant portion only.
- **Verify**: Total prompt length is within model limits with buffer. Retrieved context is relevant to current query.

### Step 4: Handle Retrieval Failures Gracefully
- If retrieval returns no relevant results: say so — do not hallucinate an answer.
- If retrieved documents are outdated: surface the document date to the user.
- If confidence is low: present the retrieved source and let the user evaluate.
- Design for "no relevant information found" as a first-class outcome.
- **Verify**: System has defined behavior for failed/empty retrieval.

### Step 5: Measure and Optimize
- Track retrieval quality:
  - **Precision**: Are retrieved chunks relevant to the query?
  - **Recall**: Are relevant chunks being retrieved at all?
- Track answer quality: Use RAGAS or similar evaluation framework.
- Monitor: context length per query, retrieval latency, hallucination rate.
- **Verify**: Baseline metrics established. Retrieval precision > 80%.

---

## Common Rationalizations (and Rebuttals)

| Excuse | Rebuttal |
|--------|----------|
| "Let's just put everything in the context" | Context bloat degrades quality and costs money. Retrieve what's needed. |
| "The model knows this from training" | Training knowledge is stale. Use RAG for current information. |
| "Vector search is good enough without re-ranking" | Re-ranking improves precision significantly. It's a small cost for large quality gain. |
| "We'll fix retrieval quality later" | Poor retrieval quality compounds into poor answer quality. Fix it now. |

---

## Red Flags 🚩
- Entire document corpus pre-loaded into every prompt
- Retrieval returning chunks from unrelated documents
- No defined behavior for empty retrieval results
- Context window regularly at 90%+ capacity
- Agent answering from "training knowledge" instead of retrieved documents
- No source citations for retrieved information

---

## Verification Checklist
- [ ] Memory architecture matches the type of information needed
- [ ] RAG pipeline: chunk → embed → retrieve → re-rank → inject
- [ ] Context budgets defined for all prompt sections
- [ ] Empty retrieval has a defined graceful fallback
- [ ] Retrieval precision measured and > 80%
- [ ] Source citations included in AI responses
