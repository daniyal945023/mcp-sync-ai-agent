# Agent Instructions(persistent conventions/rules — read every session)

## Stack
Next.js (frontend) · FastAPI (backend) · FastMCP (tool server) · LangGraph (agent orchestration)

## Conventions
- Each integration (GitHub/Slack/Notion) lives in its own `tools_*.py`, wrapped by `@mcp.tool()` in `server.py`
- All API tokens loaded via `.env`, never hardcoded
- Pin third-party API versions explicitly (see SPEC.md decisions log — Notion broke us once already)

## Before making changes
- Check docs/PROGRESS.md for current milestone and what's already done
- Don't re-implement tools that already exist — check server.py's tool list first