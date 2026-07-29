from fastmcp import FastMCP
import tools_github as gh


mcp = FastMCP("Server Ops MCP")

@mcp.tool()
def list_open_issues(limit: int = 10):
    """List open GitHub issues from the configured repo, most recent first."""
    return gh.list_open_issues(limit)

@mcp.tool()
def create_issue(title: str, body: str):
    """Create a new GitHub issue in the configured repo. Returns the issue number and URL."""
    return gh.create_issue(title,body)

if __name__ == "__main__":
    mcp.run()