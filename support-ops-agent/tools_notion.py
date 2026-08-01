import os
import requests
from dotenv import load_dotenv

load_dotenv()
#print("DATABASE ID:", repr(os.environ.get("NOTION_DATABASE_ID")))

NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID")
NOTION_VERSION = "2026-03-11" 

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

def query_database(status_filter: str | None = None) -> list[dict]:
    db_id_response = requests.get(
    f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}",
    headers=HEADERS
    )
    db_data = db_id_response.json()
    data_source_id = db_data["data_sources"][0]["id"]


    url = f"https://api.notion.com/v1/data_sources/{data_source_id}/query"
    payload = {}
    if status_filter:
        payload["filter"] = {
            "property": "Status",
            "status": {"equals": status_filter}
        }

    resp = requests.post(url, headers=HEADERS, json=payload)
    if resp.status_code != 200:
        print("NOTION ERROR:", resp.status_code, resp.json())
    resp.raise_for_status()
    results = resp.json()["results"]

    return [
        {
            "id": page["id"],
            "name": _get_title(page),
            "status": _get_status(page),
        }
        for page in results
    ]


def create_page(name: str, status: str = "Not Started", priority: str = "Normal") -> dict:
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Name": {"title": [{"text": {"content": name}}]},
            "Status": {"status": {"name": status}},
            "Priority": {"select": {"name": priority}},
        },
    }
    resp = requests.post(url, headers=HEADERS, json=payload)
    resp.raise_for_status()
    return {"id": resp.json()["id"], "url": resp.json()["url"]}



def _get_title(page: dict) -> str:
    title_prop = page["properties"].get("Name", {}).get("title", [])
    return title_prop[0]["plain_text"] if title_prop else "Untitled"


def _get_status(page: dict) -> str:
    status_prop = page["properties"].get("Status",{}).get("status")
    return status_prop["name"] if status_prop else "Unknown"


