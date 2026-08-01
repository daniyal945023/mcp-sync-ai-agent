import os
import requests
from dotenv import load_dotenv

load_dotenv()

SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
SLACK_CHANNEL_ID = os.environ.get("SLACK_CHANNEL_ID")
HEADERS = {
    "Authorization": f"Bearer {SLACK_BOT_TOKEN}",
    "Content-Type": "application/json",
}

def post_message(text: str):
    url = "https://slack.com/api/chat.postMessage"
    response = requests.post(
        url,
        headers=HEADERS,
        json={"channel": SLACK_CHANNEL_ID, "text": text}
    )

    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(f"Slack API error: {data.get('error')}")

    return {"status": "sent", "timestamp": data["ts"]}

def read_recent_messages(limit: int = 10):
    url = "https://slack.com/api/conversations.history"
    response = requests.get(
        url,
        headers=HEADERS,
        params={"channel": SLACK_CHANNEL_ID, "limit": limit}
    )

    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(f"Slack API error: {data.get('error')}")

    return [
        {"user": message.get("user"), "text": message.get("text"), "timestamp": message.get("ts")} for message in data["messages"]
        ]

