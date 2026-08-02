#mcp client serves as a bridge to convert mcp tools into langchain native tools so we can bind them with llm
import sys
import os
from pathlib import Path
from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_SERVER_DIR = Path(__file__).parent.parent / "mcp-server"
MCP_SERVER_PATH = str(MCP_SERVER_DIR / "server.py")

if sys.platform == "win32":
    MCP_SERVER_PYTHON = str(MCP_SERVER_DIR / "venv" / "Scripts" / "python.exe")
else:
    MCP_SERVER_PYTHON = str(MCP_SERVER_DIR / "venv" / "bin" / "python")

client = MultiServerMCPClient({
    "ops": {
        "command": MCP_SERVER_PYTHON,
        "args": ["-u", MCP_SERVER_PATH],
        "transport": "stdio",
    }
})



async def get_tools():
    """Loads all MCP tools (GitHub, Slack, Notion) as LangChain-compatible tools."""
    return await client.get_tools()

async def get_escalation_runbook():
    async with client.session("ops") as session:
        result = await session.read_resource("ops://runbook/escalation")
        return result.contents[0].text



    







