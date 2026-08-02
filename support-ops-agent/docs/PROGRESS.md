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
- [x] CLI test script (main.py) — verified working
- Note: hit `mcp==2.0.0` incompatibility with langchain-mcp-adapters 0.3.1, 
  pinned mcp<2.0. Also hit [whatever your MultiServerMCPClient init issue was] — 
  fixed by [changing config of MultiServerMCPClient initialization, from ops->command: python to ops->command: MCP_SERVER_PYTHON]
## Milestone 3: FastAPI Gateway — NOT STARTED
## Milestone 4: Next.js Frontend — NOT STARTED