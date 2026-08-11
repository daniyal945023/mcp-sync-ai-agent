# Progress(task checklist + status — changes every session)

## Milestone 1: FastMCP Server — IN PROGRESS
- [x] GitHub tools: list_open_issues, create_issue
- [x] Slack tools: post_message, read_recent_messages
- [x] Notion tools: query_database, create_page
  - Note: Notion deprecated /v1/databases/{id}/query — migrated to 
    /v1/data_sources/{id}/query, pinned Notion-Version to 2025-09-03
- [x] Add one @mcp.resource() (e.g. Notion schema or runbook)
- [x] Add one @mcp.prompt() (e.g. triage_issue template)
- [x] EDGE CASE: In case of no items in Github,Slack or Notion, the tool returned an empty list [], which LLM treated as a failed/inconclusive response, assuming it needed to retry, which led to an infinite tool-calling loop.
SOLUTION: Modified the tools to return an explicit dictionary with a descriptive message, for e.g {"status": "success", "count": 0, "message": "No open GitHub issues found in the repository."}


## Milestone 2: LangGraph Agent — COMPLETE
- [x] MCP client connects to mcp-server (stdio transport)
- [x] Graph: agent node (Claude + tools) <-> tools node, conditional routing
- [x] Escalation runbook resource injected into system prompt
- [x] Fixed placeholder-substitution bug (model was echoing literal 
      <issue_number> instead of using real tool-call results — fixed via 
      explicit "never output placeholder text" instruction in both the 
      runbook resource and system prompt)
- [x] Conversation memory via InMemorySaver checkpointer, keyed by thread_id
- [x] CLI test script (main.py) — verified: multi-tool orchestration, 
      escalation flow, follow-up context retention
  -Note: hit `mcp==2.0.0` incompatibility with langchain-mcp-adapters 0.3.1, 
  pinned mcp<2.0. Also hit with MultiServerMCPClient init issue — 
  fixed by [changing config of MultiServerMCPClient initialization, from ops->command: python to ops->command: MCP_SERVER_PYTHON]

## Milestone 3: FastAPI Gateway — COMPLETE
- [x] /health and /chat/stream endpoints
- [x] SSE streaming via astream_events (v2) — tokens, tool_start/tool_end, done
- [x] Postgres-backed checkpointing (AsyncPostgresSaver) via Docker
- [x] CORS configured for localhost:3000
- [x] Fixed: agent was taking proactive escalation actions on read-only queries — 
      tightened system prompt to require explicit user intent or clear trigger match
- Note: backend/venv must mirror agent/venv's full dependency set, since 
  backend imports agent/graph.py directly across the folder boundary. 
  Stretch goal: convert agent/ into an installable local package.


## Milestone 4: Next.js Frontend — COMPLETE
- [x] Chat UI with streaming tokens + live tool-call indicators
- [x] Suggestion cards (GitHub/Slack/Notion/Escalation) tied to real prompts
- [x] Rebrand to ConduitAI, purple accent, responsive sidebar (drawer on mobile)
- [x] thread_id persisted in localStorage, New Chat resets it
- [x] Fixed: double-word rendering bug — setMessages updater was mutating 
      `prev` directly instead of returning new objects; React Strict Mode's 
      double-invocation of updaters exposed it. Fixed by making the updater 
      fully immutable.

## PROJECT 1: Support Ops Agent — COMPLETE (core build)

## Milestone 5: Adding Voice Input and Output
- [x] Voice input (STT): react-speech-recognition — a thin, actively-maintained wrapper around the browser's built-in Web Speech API. It provides a useSpeechRecognition hook exposing a live transcript, plus SpeechRecognition.startListening()/stopListening() to control the mic.
- [x] Voice output (TTS): the browser's native SpeechSynthesis API directly; We wrote a custom hook useTextToSpeech.tsx.
- [x] Glowing orb: pure CSS (conic-gradient + blur + keyframe animation).
- [x] Improved: voice input transcription for product names
  - Implemented a lightweight post-processing layer for speech transcripts to correct common Web Speech API misrecognitions such as "GitHub" → "get hub" and "Slack" → "slap".
  - This normalization runs client-side before the prompt is sent to the agent, improving reliability for voice-driven workflows without adding heavy dependencies.


## Milestone 6: Authentication — COMPLETE
- [x] Clerk integration (frontend sign-in/sign-up, middleware route protection)
- [x] Backend verifies Clerk JWT via clerk-backend-api (official SDK, avoids 
      deprecated python-jose pattern with known CVE)
- [x] /chat/stream requires valid auth — verified 401 on unauthenticated curl test
- Note: shared service credentials model — all users share one GitHub/Slack/Notion 
  integration; auth scopes app identity + chat history, not third-party access. 
  Per-user OAuth flagged as a legitimate stretch goal, out of scope for now.

## Milestone 7: Chat History — COMPLETE
- [x] threads table (thread_id, user_id, title, created_at)
- [x] Auto-create thread record + derived title on first message
- [x] GET /threads (list, scoped to authenticated user)
- [x] GET /threads/{thread_id}/messages (ownership-checked, reads LangGraph 
      checkpoint state directly rather than duplicating message storage)
- [x] Sidebar wired to real data, click-to-load past conversations
- [x] Fixed: page reload wasn't restoring active thread — mount effect only 
      read thread_id from localStorage without loading its history; fixed by 
      calling selectThread() on mount instead of just setting the ref



## Milestone 7: Multi-Agent Architecture — COMPLETE
- [x] Supervisor + devops_agent (GitHub) + comms_agent (Slack/Notion), 
      via agent-as-tool pattern (create_agent + @tool-wrapped delegate calls)
- [x] Fixed: multi-agent wrapper was returning child-agent results in a format Groq rejected for tool messages
  - Root cause: the supervisor was receiving structured/complex content from delegated child agents instead of a plain text string
  - Fix: normalized child-agent output to a simple string before returning it from the wrapper tool
- [x] Fixed: Groq rate-limit / bad-request failures caused retry storms
  - Root cause: retries were firing immediately on provider errors, consuming quota faster
  - Fix: added explicit handling for rate-limit and bad-request errors, with graceful fallback responses instead of aggressive retry loops
- [x] Fixed: child-agent wrapper tools were not correctly scoped around the specialist agents
  - Root cause: helper logic and wrapper tools were not properly closing over the created `devops_agent` / `comms_agent` instances
  - Fix: moved helper logic inside the graph build flow so the wrapper tools reliably invoke the correct agents
- [x] Fixed: model occasionally emitted malformed tool-call payloads, Groq requires strict payload schema which was corrupted due to nested tool calls
  - Mitigation: lowered temperature to `0.1` and kept tool-call delegation structured for more stable behavior
- [x] Verified via CLI: GitHub listing, Slack listing, and escalation flow all work end-to-end through the multi-agent supervisor
- [x] Fixed: nested sub-agent streams caused duplicated/interleaved output — 
      switched from live token streaming to final-message-on-completion, 
      since attributing tokens to the correct sub-agent mid-stream is 
      unreliable with nested runs. Tool-call indicators still stream live; 
      final answer renders as one clean markdown block once the run completes.
- [x] Added react-markdown + remark-gfm for proper formatting


## Milestone 8: Image Input — COMPLETE
- [x] Swapped shared model to meta-llama/llama-4-scout-17b-16e-instruct (vision-capable)
- [x] Backend: ChatRequest accepts optional base64 image, builds multimodal 
      HumanMessage when present
- [x] Frontend: image upload + preview, sent alongside text message
- [x] Verified: supervisor interprets image, delegates description to 
      devops_agent/comms_agent as text (delegate tools stay text-only by design)

## CORE FEATURES COMPLETE (Milestones 1-8)
Multi-tool MCP server (GitHub/Slack/Notion + resource + prompt) → multi-agent 
LangGraph supervisor → FastAPI SSE gateway → Next.js UI (ConduitAI, responsive, 
voice in/out, image input) → Clerk auth → persistent per-user chat history.

ERROR: If i send a message, and close the window haphazardly while waiting for llm response, and reopen it, my sent message still appears without any llm response. Ideally, when i reopen the window, my sent message should disappear
ADDED: I need a delete functionality for a chat session
ADDED: Web speech api isnt able to accurately "hear" certain words such as Slack and Github
ERROR: If github issues,notion tracker or slack messages r empty, the llm gets confused
ERROR: LLM takes very long to execute entire workflow of creating issue,sending msg and updating notion db

## Milestone 9: Docker — NOT STARTED
## Milestone 10: CI/CD (GitHub Actions) — NOT STARTED
## Milestone 11: Redis + WebSockets — NOT STARTED
## Milestone 12-14: Hardening (logging, tests, security) — NOT STARTED
## Milestone 15: Deployment — NOT STARTED
## Milestone 16-18: Rate limiting, billing demo, load testing — NOT STARTED