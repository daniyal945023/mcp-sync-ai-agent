from fastmcp import FastMCP
import tools_github as gh
import tools_slack as slack
import tools_notion as notion

mcp = FastMCP("Server Ops MCP")

@mcp.tool()
def list_open_issues(limit: int = 10):
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
def read_slack_messages(limit: int = 10) -> list[dict]: 
    """Read the most recent messages from the team's Slack channel."""
    return slack.read_recent_messages(limit)

@mcp.tool()
def query_notion_tickets(status_filter: str | None = None) -> list[dict]:
    """Query the Notion tracker. Optionally filter by status (e.g. 'Not started', 'In progress', 'Done')."""
    return notion.query_database(status_filter)

@mcp.tool()
def create_notion_ticket(name: str, status: str = "Not Started", priority: str = "Normal"):
    """Create a new ticket in the Notion tracker."""
    return notion.create_page(name,status,priority)


if __name__ == "__main__":
    mcp.run()