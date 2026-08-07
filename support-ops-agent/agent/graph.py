import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, MessagesState, START #MessagesState is prebuilt state with a schema
from langgraph.prebuilt import ToolNode, tools_condition  #ToolNode is prebuilt,eliminating the need to write tool calling function
from langchain_core.messages import SystemMessage
from mcp_client import get_tools, get_escalation_runbook #mcp server tools and resource can now be used as langchain tools thanks to mcp client,which was the bridge between this langgraph agent and mcp server
from langgraph_supervisor import create_supervisor
from langchain.agents import create_agent
from langgraph_supervisor import create_supervisor
from langchain_core.tools import tool
from tenacity import retry, stop_after_attempt, wait_fixed,before_sleep_log
from groq import BadRequestError, RateLimitError
import logging
import json

current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
env_path = parent_dir / ".env"


load_dotenv(dotenv_path=env_path)

GITHUB_TOOLS = {"list_open_issues", "create_issue"}
COMMS_TOOLS = {"post_slack_message", "read_slack_messages", "query_notion_tickets", "create_notion_ticket"}

async def build_graph(checkpointer=None):
    tools = await get_tools()
    escalation_runbook = await get_escalation_runbook()

    github_tools = [t for t in tools if t.name in GITHUB_TOOLS]
    comms_tools = [t for t in tools if t.name in COMMS_TOOLS]


    groq_llm = ChatGroq(
        model="openai/gpt-oss-120b",
        temperature=0.1
    )
    

    devops_agent = create_agent(
        model=groq_llm,
        tools=github_tools,
        name="devops_agent",
        system_prompt="""You handle GitHub only. You can list open issues and create new ones.
        Do not attempt Slack or Notion actions — that's outside your scope.""",
    )

    comms_agent = create_agent(
        model=groq_llm,
        tools=comms_tools,
        name="comms_agent",
        system_prompt=f"""You handle Slack and Notion. You can post/read Slack messages and 
manage the Notion tracker.

Escalation policy:
{escalation_runbook}

Only escalate when explicitly asked or when a message clearly matches the policy above 
— never proactively escalate on read-only requests.

Critical: when referencing data from a prior tool call (like an issue number), use the 
ACTUAL returned value — never output literal placeholder text like <number>.""",
    )

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    async def _safe_invoke(agent, query: str) -> str:
        try:
            response = await agent.ainvoke({"messages": [("user", query)]})
        except RateLimitError as e:
            logger.warning("Groq rate limit hit: %s", e)
            return "Groq is temporarily rate-limiting requests. Please try again in a moment."
        except BadRequestError as e:
            logger.warning("Groq bad request: %s", e)
            return "The request failed due to a model formatting error."

        last_msg = response["messages"][-1]
        content = getattr(last_msg, "content", "")

        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and "text" in item:
                    parts.append(item["text"])
                else:
                    parts.append(str(item))
            content = "\n".join(parts)

        elif not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False)

        return content

    @tool
    async def call_devops_agent(query: str) -> str:
        """Use this tool to delegate GitHub tasks like listing or creating repository issues."""
        return await _safe_invoke(devops_agent, query)

    @tool
    async def call_comms_agent(query: str) -> str:
        """Use this tool to delegate Slack messaging or Notion ticket tracker management."""
        return await _safe_invoke(comms_agent, query)
    
        

    supervisor_agent = create_agent(
        model=groq_llm,
        tools=[call_devops_agent,call_comms_agent],
        name="supervisor",
        system_prompt="""You coordinate two specialists:
- devops_agent: GitHub issues (list, create)
- comms_agent: Slack messages and Notion tracker

Route each request to the right specialist. For requests needing both (e.g. "escalate 
this issue"), call devops_agent first to create the GitHub issue, then call comms_agent 
with the real issue number to notify Slack — in that order, never the reverse.""",
checkpointer=checkpointer
    )


    return supervisor_agent


