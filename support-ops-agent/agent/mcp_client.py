#mcp client serves as a bridge to convert mcp tools into langchain native tools so we can bind them with llm

import os
from pathlib import Path
from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_SERVER_PATH = str(Path(__file__).parent.parent / "mcp-server" / "server.py")

client = MultiServerMCPClient({
    "ops": {
        "command": "python",
        "args": [MCP_SERVER_PATH],
        "transport": "stdio",
    }
})



async def get_tools():
    """Loads all MCP tools (GitHub, Slack, Notion) as LangChain-compatible tools."""
    return await client.get_tools()

async def get_escalation_runbook():
    async with client.session("ops") as session:
        result = session.read_resource("ops://runbook/escalation")
        return result.contents[0].text



    







