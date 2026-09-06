import pytest
from fastapi import HTTPException
from backend.utils import normalize_content, ensure_thread_access


# -----------------------------
# Fixtures
# -----------------------------
class FakeConnection:
    def __init__(self):
        self.fetchrow_result = None
        self.inserted_user_id = None
        self.inserted_thread_id = None
        self.inserted_title = None

    async def fetchrow(self, query, *args):
        return self.fetchrow_result

    async def execute(self, query, *args):
        # args: (thread_id, user_id, title)
        if len(args) >= 3:
            self.inserted_thread_id = args[0]
            self.inserted_user_id = args[1]
            self.inserted_title = args[2]


@pytest.fixture
def fake_connection():
    return FakeConnection()


# -----------------------------
# Content Normalization Tests
# -----------------------------
def test_normalize_string():
    assert normalize_content("hello") == "hello"


def test_normalize_text_dictionary():
    value = {"type": "text", "text": "hello"}
    assert normalize_content(value) == "hello"


def test_normalize_list_with_text():
    value = [{"type": "text", "text": "hello"}]
    assert normalize_content(value) == "hello"


# -----------------------------
# Thread Access Tests
# -----------------------------
@pytest.mark.asyncio
async def test_user_can_create_new_thread(fake_connection):
    # Arrange: the database has no matching thread.
    fake_connection.fetchrow_result = None

    # Act: call the ownership helper.
    await ensure_thread_access(
        fake_connection,
        "thread-1",
        "user-a",
        "First chat",
    )

    # Assert: a new thread was inserted.
    assert fake_connection.inserted_user_id == "user-a"


@pytest.mark.asyncio
async def test_user_cannot_use_another_users_thread(fake_connection):
    # Arrange: the thread belongs to user-b.
    fake_connection.fetchrow_result = {"user_id": "user-b"}

    # Act and assert: user-a is rejected.
    with pytest.raises(HTTPException) as error:
        await ensure_thread_access(
            fake_connection,
            "thread-1",
            "user-a",
            "Trying to access another user's chat",
        )

    assert error.value.status_code == 404