import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, MessagesState, START #MessagesState is prebuilt state with a schema
from langgraph.prebuilt import ToolNode, tools_condition  #ToolNode is prebuilt,eliminating the need to write tool calling function
from langchain_core.messages import SystemMessage
from mcp_client import get_tools, get_escalation_runbook #mcp server tools and resource can now be used as langchain tools thanks to mcp client,which was the bridge between this langgraph agent and mcp server

current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
env_path = parent_dir / ".env"


load_dotenv(dotenv_path=env_path)

async def build_graph(checkpointer=None):
    tools = await get_tools()
    escalation_runbook = await get_escalation_runbook()
    groq_llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.7
    )
    groq_llm_with_tools = groq_llm.bind_tools(tools) #this allows llm to autonomously perform operations in slack,github and notion

    system_prompt = f"""You are a support ops agent with access to GitHub, Slack, and Notion.

IMPORTANT: Only take actions (creating GitHub issues, posting to Slack, creating 
Notion pages) when the user explicitly asks you to, OR when their current message 
describes a new problem that clearly matches an escalation trigger below. 

Simply listing, viewing, or reading information (e.g. "show my open issues") is a 
read-only request — never take follow-up actions on read-only requests unless the 
user asks you to.

Escalation policy (only apply when genuinely warranted by the CURRENT message):

{escalation_runbook}

Critical rule: when a message references data from a previous tool call (like an 
issue number), you must use the ACTUAL value returned by that tool — never output 
placeholder text like <number> or <issue_number> literally.

Always explain briefly what action you took and why."""

    async def call_agent_node(state: MessagesState):
        messages = [SystemMessage(content=system_prompt)] + state["messages"] #add the system prompt in messages state
        response = await groq_llm_with_tools.ainvoke(messages)
        return {"messages": response} #we add the response to the state as well

    builder = StateGraph(MessagesState)
    builder.add_node("agent", call_agent_node)
    builder.add_node("tools", ToolNode(tools))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", tools_condition) #if agent makes tool call -> tools node, else END with final response(e.g. see the GitHub issues, then decide to post to Slack). this loop is what makes it agentic rather than a single request/response
    builder.add_edge("tools","agent")

    

    return builder.compile(checkpointer=checkpointer)


