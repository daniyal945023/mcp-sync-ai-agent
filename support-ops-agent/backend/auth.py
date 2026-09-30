import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
load_dotenv(dotenv_path=parent_dir / ".env")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
DEMO_TOKEN_SECRET = os.getenv("DEMO_TOKEN_SECRET")
DEMO_TOKEN_TTL_SECONDS = 60 * 60 * 12

clerk_sdk = Clerk(bearer_auth=os.environ["CLERK_SECRET_KEY"])


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded)


def create_demo_token() -> str:
    if not DEMO_TOKEN_SECRET:
        raise HTTPException(status_code=503, detail="Demo mode is not configured")

    payload = {
        "sub": f"demo:{secrets.token_urlsafe(18)}",
        "iss": "support-ops-demo",
        "exp": int(time.time()) + DEMO_TOKEN_TTL_SECONDS,
    }
    encoded_payload = _b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature = hmac.new(
        DEMO_TOKEN_SECRET.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"demo.{encoded_payload}.{_b64encode(signature)}"


def _verify_demo_token(token: str) -> str:
    if not DEMO_TOKEN_SECRET:
        raise HTTPException(status_code=503, detail="Demo mode is not configured")

    try:
        prefix, encoded_payload, encoded_signature = token.split(".")
        if prefix != "demo":
            raise ValueError("Invalid token prefix")

        expected_signature = hmac.new(
            DEMO_TOKEN_SECRET.encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        supplied_signature = _b64decode(encoded_signature)

        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise ValueError("Invalid signature")

        payload = json.loads(_b64decode(encoded_payload))
        if (
            payload.get("iss") != "support-ops-demo"
            or payload.get("exp", 0) <= int(time.time())
            or not payload.get("sub", "").startswith("demo:")
        ):
            raise ValueError("Expired or invalid demo token")

        return payload["sub"]
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Invalid demo token")


def get_current_user_id(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() == "bearer" and token.startswith("demo."):
        return _verify_demo_token(token)

    request_state = clerk_sdk.authenticate_request(
        request,
        AuthenticateRequestOptions(authorized_parties=[FRONTEND_URL]),
    )

    if not request_state.is_signed_in:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return request_state.payload["sub"]