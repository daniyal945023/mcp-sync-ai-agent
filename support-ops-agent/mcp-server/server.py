from fastmcp import FastMCP
import tools_github as gh
import tools_slack as slack
import tools_notion as notion
from fastmcp.prompts import Message


mcp = FastMCP("Server Ops MCP")

@mcp.tool()
def list_open_issues(limit: int | str = 10) -> list[dict] | dict:
    """List open GitHub issues from the configured repo, most recent first."""
    return gh.list_open_issues(limit)

@mcp.tool()
def create_issue(title: str, body: str):
    """Create a new GitHub issue in the configured repo. Returns the issue number and URL."""
    return gh.create_issue(title,body)

@mcp.tool()
def post_slack_message(text: str) -> dict: 
    """Post a message to the team's Slack channel. Use for notifications, summaries, or escalations."""
    return slack.post_message(text)

@mcp.tool()
def read_slack_messages(limit: int | str = 10) -> list[dict] | dict: 
    """Read the most recent messages from the team's Slack channel."""
    return slack.read_recent_messages(limit)

@mcp.tool()
def query_notion_tickets(status_filter: str | None = None) -> list[dict] | dict:
    """Query the Notion tracker. Optionally filter by status (e.g. 'Not started', 'In progress', 'Done')."""
    return notion.query_database(status_filter)

@mcp.tool()
def create_notion_ticket(name: str, status: str = "Not Started", priority: str = "Normal"):
    """Create a new ticket in the Notion tracker."""
    return notion.create_page(name,status,priority)


 #mcp resources r additional context to llm(static content)
@mcp.resource("ops://runbook/escalation")
def escalation_runbook() -> str:
    """Escalation policy the agent should follow when deciding to notify the team."""
    return """
# Escalation Runbook

## When to escalate to Slack
- Issue labeled 'critical' or 'security' on GitHub → escalate immediately
- User reports login/auth failures → escalate within 1 hour
- Billing discrepancies → escalate, do not attempt to resolve directly

## When NOT to escalate
- Questions answerable from the knowledge base
- Feature requests (log as GitHub issue instead, no Slack ping needed)

## Escalation procedure (follow in order)
1. Call create_github_issue first. Wait for its result.
2. Take the exact "number" value returned by that tool call.
3. Call post_slack_message with the text formatted EXACTLY as:
   "[ESCALATION] <one-line summary> — see GitHub issue #<the real number from step 2>"

IMPORTANT: Never write the literal characters "<issue_number>" or "<number>" in 
the Slack message. Those are placeholder names for you to explain the format — 
you must substitute the actual integer returned by create_github_issue.
"""

#mcp prompt is ui-based slash command and user can click it, It doesn't run logic itself,rather it returns a structured message that pre-fills how the agent should approach a task.( a detailed user prompt)
@mcp.prompt()
def triage_issue(issue_title: str, issue_body: str) -> list[Message]:
    """Generate a structured triage request for a new issue."""
    return [
        Message(
            role="user",
            content=f"""Triage this issue and decide the right action:

Title: {issue_title}
Body: {issue_body}

Steps:
1. Check the escalation runbook (ops://runbook/escalation) to see if this qualifies for escalation
2. If it does, post a Slack notification following the runbook's format
3. Log it as a Notion ticket with an appropriate priority
4. Reply with a one-line summary of what you did
"""
        )
    ]
    


 



if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8001)