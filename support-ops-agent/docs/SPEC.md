# Project Spec: Support Ops Agent(architecture + decisions — changes rarely)

## Goal
Multi-tool AI agent (GitHub + Slack + Notion) demonstrating FastMCP + LangGraph, 
built as a portfolio piece

## Architecture
Next.js (chat UI) → FastAPI (gateway, SSE streaming) → LangGraph (agent graph) 
→ FastMCP client → FastMCP server (tools/resources/prompts) → GitHub/Slack/Notion APIs

## Key decisions
- Token-based auth (PAT/bot token/integration token) over OAuth — faster to build, 
  same tool-calling pattern, OAuth deferred to Project 2 as a stretch skill
- Notion API pinned to 2025-09-03 (data_sources query flow) — see PROGRESS.md 2026-08-01 entry

## Instructions to run the project
- Terminal 1 — Postgres:
    cd backend
    docker compose up -d
- Terminal 2 - Backend
    cd backend
    venv\Scripts\activate
    uvicorn main:app --reload
- Terminal 3 - Frontend
    cd frontend
    npm run dev
