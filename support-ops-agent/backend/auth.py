import os
from fastapi import Request, HTTPException
from clerk_backend_api import Clerk
from clerk_backend_api.security import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from pathlib import Path

current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
env_path = parent_dir / ".env"

load_dotenv(dotenv_path=env_path)

clerk_sdk = Clerk(bearer_auth=os.environ["CLERK_SECRET_KEY"])

def get_current_user_id(request: Request):
    request_state = clerk_sdk.authenticate_request(
        request,
        AuthenticateRequestOptions(
            authorized_parties=["http://localhost:3000"]  # only trust our frontend's origin
        )
    )

    if not request_state.is_signed_in:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return request_state.payload["sub"]    # "sub" is Clerk's user ID claim