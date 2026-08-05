# Progress(task checklist + status — changes every session)

## Milestone 1: FastMCP Server — IN PROGRESS
- [x] GitHub tools: list_open_issues, create_issue
- [x] Slack tools: post_message, read_recent_messages
- [x] Notion tools: query_database, create_page
  - Note: Notion deprecated /v1/databases/{id}/query — migrated to 
    /v1/data_sources/{id}/query, pinned Notion-Version to 2025-09-03
- [x] Add one @mcp.resource() (e.g. Notion schema or runbook)
- [x] Add one @mcp.prompt() (e.g. triage_issue template)


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