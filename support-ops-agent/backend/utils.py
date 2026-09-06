import json
from fastapi import HTTPException


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


async def ensure_thread_access(conn, thread_id: str, user_id: str, title: str):
    existing = await conn.fetchrow(
        "SELECT user_id FROM threads WHERE thread_id = $1",
        thread_id,
    )

    if existing and existing["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Thread not found")

    if not existing:
        await conn.execute(
            "INSERT INTO threads (thread_id, user_id, title) VALUES ($1, $2, $3)",
            thread_id,
            user_id,
            title,
        )
