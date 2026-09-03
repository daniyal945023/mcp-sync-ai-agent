#mcp client serves as a bridge to convert mcp tools into langchain native tools so we can bind them with llm
import sys
import os
from pathlib import Path
from langchain_mcp_adapters.client import MultiServerMCPClient



client = MultiServerMCPClient({
    "ops": {
        "transport": "http",
        "url": os.getenv("MCP_SERVER_URL", "http://localhost:8001/mcp"),
    }
})



async def get_tools():
    """Loads all MCP tools (GitHub, Slack, Notion) as LangChain-compatible tools."""
    return await client.get_tools()

async def get_escalation_runbook():
    async with client.session("ops") as session:
        result = await session.read_resource("ops://runbook/escalation")
        return result.contents[0].text



    







