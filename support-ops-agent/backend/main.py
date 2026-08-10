import os
import sys
import json
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import Depends, HTTPException
from auth import get_current_user_id
import asyncpg
from langchain_core.messages import HumanMessage, AIMessage


sys.path.insert(0, str(Path(__file__).parent.parent / "agent"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langchain_core.messages import HumanMessage
from graph import build_graph

current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
env_path = parent_dir / ".env"

load_dotenv(dotenv_path=env_path)
DATABASE_URL = os.environ["DATABASE_URL"]

graph = None
checkpointer_cm = None

@asynccontextmanager #prevents memory and connection leaks that occur from program crash
async def lifespan(app: FastAPI):
    global graph, checkpointer_cm, db_pool
    checkpointer_cm = AsyncPostgresSaver.from_conn_string(DATABASE_URL)
    checkpointer = await checkpointer_cm.__aenter__()
    await checkpointer.setup()   # creates the checkpoint tables on first run — safe to call every startup, it's idempotent
    graph = await build_graph(checkpointer=checkpointer)
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    async with db_pool.acquire() as conn:
        await conn.execute(
            """CREATE TABLE IF NOT EXISTS threads (
            thread_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now())"""
        )
    yield
    await db_pool.close()
    await checkpointer_cm.__aexit__(None, None, None)


def normalize_content(content):
    if isinstance(content, str):
        return content

    if isinstance(content, dict):
        if content.get("type") == "text" and isinstance(content.get("text"), str):
            return content["text"]
        if isinstance(content.get("text"), str):
            return content["text"]
        return json.dumps(content, ensure_ascii=False)

    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                return item["text"]
        return json.dumps(content, ensure_ascii=False)

    return str(content)

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: str
    image: str | None = None

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    config = {"configurable": {"thread_id": req.thread_id}}



    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT thread_id from threads where thread_id = $1", req.thread_id
        )
        if not existing:
            title = req.message[:50] + ("..." if len(req.message) > 50 else "")
            await conn.execute(
                "INSERT INTO threads (thread_id, user_id, title) VALUES ($1, $2, $3)",
                req.thread_id, user_id, title,
            )

    if req.image:
        content = [
            {"type": "text", "text": req.message},
            {"type": "image_url", "image_url": {"url": req.image}}
        ]
    else:
        content = req.message

    human_message = HumanMessage(content=content)

    async def event_generator():
        async for event in graph.astream_events(
            {"messages": [human_message]},
            config=config,
            version="v2"
        ):
            kind = event["event"]
            

            if kind == "on_tool_start":
                yield f"data: {json.dumps({'type': 'tool_start', 'name': event['name']})}\n\n"

            elif kind == "on_tool_end":
                yield f"data: {json.dumps({'type': 'tool_end', 'name': event['name']})}\n\n"

        final_state = await graph.aget_state(config)
        #final_content = final_state.values["messages"][-1].content
        final_content = normalize_content(final_state.values["messages"][-1].content)

        if isinstance(final_content, dict):
            final_content = final_content.get("text", json.dumps(final_content, ensure_ascii=False))
        elif isinstance(final_content, list):
            final_content = json.dumps(final_content, ensure_ascii=False)

        yield f"data: {json.dumps({'type': 'final_message', 'content': final_content})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/threads")
async def list_threads(user_id: str = Depends(get_current_user_id)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT thread_id, title, created_at FROM threads WHERE user_id = $1 ORDER BY created_at DESC",user_id
        )
        
    return [dict(row) for row in rows]

@app.get("/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str, user_id: str = Depends(get_current_user_id)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT user_id FROM threads WHERE thread_id = $1", thread_id)

        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Thread not found")

    config = {"configurable": {"thread_id": thread_id}}
    state = await graph.aget_state(config)
    messages = state.values.get("messages",[])

    result = []
    for m in messages:
        if isinstance(m,HumanMessage):
            content = m.content
        elif isinstance(m,AIMessage) and m.content:
            content = m.content
        else:
            continue

        content = normalize_content(content)

        result.append({"role": "assistant" if isinstance(m, AIMessage) else "user", "content": content})  
    return result

@app.get("/health")
async def health():
    return {"status": "ok"}




