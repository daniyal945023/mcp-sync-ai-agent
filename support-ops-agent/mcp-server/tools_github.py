import os
import requests
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO")
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
}

def list_open_issues(limit: int = 10):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/issues"
    response = requests.get(url, headers=HEADERS, params={"state":"open", "per_page": limit})
    response.raise_for_status() #automatically throw error in case of failed request/fetch
    return [
        {"issue_number": item["number"], "issue_title": item["title"], "labels": [label["name"] for label in item["labels"]]} for item in response.json()
    ]

def create_issue(title: str, body: str):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/issues"
    response = requests.post(url, headers=HEADERS, json={"title": title, "body": body})

    return {"number": response.json()["number"], "url": response.json()["html_url"]}


