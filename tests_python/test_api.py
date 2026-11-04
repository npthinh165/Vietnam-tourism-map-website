import base64
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import bcrypt
import pytest

from backend.app import create_app
from backend.database import insert, migrate, one, seed
from backend.domain import HttpError, credentials, itinerary_input, tier_for, vietnam_day
from backend.rewards import award_points
from backend.security import csrf_for, digest

HEADERS = {"Origin": "http://localhost:3000"}
PASSWORD = "a secure password 2026"


def signup(client, email="test@example.com"):
    response = client.post(
        "/api/auth/signup",
        json={
            "name": "Test user",
            "email": email,
            "password": PASSWORD,
        },
        headers=HEADERS,
    )
    assert response.status_code == 201, response.json
    return response.json


def test_signup_session_and_logout(app, client):
    data = signup(client)
    assert data["user"]["points"] == 50
    assert client.get("/api/auth/session").json["user"]["email"] == "test@example.com"
    row = app.extensions["database"].run(lambda conn: one(conn, 'SELECT * FROM "User"'))
    assert row["passwordHash"].startswith("$2b$12$")
    response = client.post(
        "/api/auth/signout", json={}, headers={**HEADERS, "X-CSRF-Token": data["csrfToken"]}
    )
    assert response.status_code == 204
    assert client.get("/api/auth/session").json["user"] is None


def write(client, path, data, auth, method="POST", extra=None):
    return client.open(
        path,
        method=method,
        json=data,
        headers={
            **HEADERS,
            "X-CSRF-Token": auth["csrfToken"],
            **(extra or {}),
        },
    )


def test_error_rollback_preserves_session_and_points(app, client):
    auth = signup(client)
    duplicate = client.post(
        "/api/auth/signup",
        json={
            "name": "Duplicate",
            "email": "TEST@example.com",
            "password": PASSWORD,
        },
        headers=HEADERS,
    )
    assert duplicate.status_code == 409
    assert client.get("/api/auth/session").json["user"]["points"] == 50
    missing = write(
        client,
        "/api/v1/places/99999/review",
        {
            "rating": 5,
            "content": "Một điểm đến rất đáng để trải nghiệm.",
        },
        auth,
        "PUT",
    )
    assert missing.status_code == 404
    response = client.get("/api/auth/session")
    assert response.status_code == 200, response.json
    assert response.json["user"]["points"] == 50


def test_http_validation_csrf_rate_limits_and_public_privacy(app, client):
    auth = signup(client)
    post = {"content": "Một chuyến du lịch", "province": "Ha Giang", "imageUrl": ""}
    assert (
        write(
            client, "/api/v1/posts", post, auth, extra={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert write(client, "/api/v1/posts", post, auth, extra={"X-CSRF-Token": ""}).status_code == 403
    assert (
        write(client, "/api/v1/posts", {**post, "authorId": str(uuid4())}, auth).status_code == 422
    )
    assert (
        write(
            client, "/api/v1/posts", {**post, "imageUrl": "http://example.com/photo"}, auth
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/posts", data="{", headers={**HEADERS, "Content-Type": "application/json"}
        ).status_code
        == 400
    )
    assert client.post("/api/v1/posts", data="{}", headers=HEADERS).status_code == 415
    assert (
        client.post(
            "/api/v1/posts",
            data='"' + "x" * 270000 + '"',
            headers={**HEADERS, "Content-Type": "application/json"},
        ).status_code
        == 413
    )
    created = write(client, "/api/v1/posts", post, auth)
    assert created.status_code == 201
    response = client.get("/api/v1/posts")
    assert response.json["items"][0]["province"] == "Tuyên Quang"
    assert set(response.json["items"][0]["author"]) == {"id", "name", "points", "tier"}
    assert response.headers["Cache-Control"] == "no-store"
    assert "Cookie" in response.headers["Vary"]
    for _ in range(10):
        denied = client.post(
            "/api/auth/signin",
            json={"email": "absent@example.com", "password": "wrong"},
            headers=HEADERS,
        )
        assert denied.status_code == 401
    limited = client.post(
        "/api/auth/signin",
        json={"email": "absent@example.com", "password": "wrong"},
        headers=HEADERS,
    )
    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "900"


PLAN = {
    "title": "Hành trình Hà Nội",
    "description": "Một ngày tham quan",
    "province": "Hà Nội",
    "visibility": "PRIVATE",
    "days": [
        {
            "title": "Ngày đầu tiên",
            "activities": [
                {
                    "time": "08:00",
                    "endTime": "09:00",
                    "title": "Thăm Văn Miếu",
                    "place": "Văn Miếu",
                    "notes": "",
                    "cost": 50000,
                }
            ],
        }
    ],
}


def test_itinerary_privacy_versions_idempotency_and_cascade(app, client):
    auth = signup(client)
    guest = app.test_client()
    identifier = str(uuid4())
    path = f"/api/v1/itineraries/{identifier}"
    first = write(client, "/api/v1/itineraries", {**PLAN, "id": identifier}, auth)
    assert first.status_code == 201
    assert write(client, "/api/v1/itineraries", {**PLAN, "id": identifier}, auth).status_code == 201
    assert guest.get(path).status_code == 404
    assert guest.get("/api/v1/itineraries").json["items"] == []
    assert guest.get("/api/v1/itineraries?mine=true").status_code == 401
    assert len(client.get("/api/v1/itineraries?mine=true").json["items"]) == 1
    updated = write(client, path, {**PLAN, "visibility": "PUBLIC", "version": 1}, auth, "PUT")
    assert updated.json["version"] == 2
    assert guest.get(path).status_code == 200
    assert write(client, path, {**PLAN, "version": 1}, auth, "PUT").status_code == 409
    assert write(client, path + "?version=1", {}, auth, "DELETE").status_code == 409
    assert write(client, path + "?version=2", {}, auth, "DELETE").status_code == 204
    db = app.extensions["database"]
    assert db.run(lambda conn: one(conn, 'SELECT count(*) AS n FROM "Activity"'))["n"] == 0
    assert client.get("/api/auth/session").json["user"]["points"] == 80


def test_rewards_concurrency_daily_caps_and_failed_transaction(app, client):
    auth = signup(client)
    db, user_id = app.extensions["database"], auth["user"]["id"]
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(
            executor.map(
                lambda _: db.run(lambda conn: award_points(conn, user_id, "REVIEW", "same-source")),
                range(4),
            )
        )
    assert sum(results) == 20
    for i in range(7):
        db.run(lambda conn: award_points(conn, user_id, "REVIEW", f"source-{i}"))
    assert client.get("/api/auth/session").json["user"]["points"] == 150
    assert (
        db.run(lambda conn: one(conn, 'SELECT sum(amount) AS total FROM "PointEntry"'))["total"]
        == 150
    )

    def failing(conn):
        award_points(conn, user_id, "ITINERARY", "rolled-back")
        raise RuntimeError("rollback")

    with pytest.raises(RuntimeError):
        db.run(failing)
    assert (
        db.run(
            lambda conn: one(
                conn, 'SELECT count(*) AS n FROM "PointEntry" WHERE source = %s', ("rolled-back",)
            )
        )["n"]
        == 0
    )
    assert client.get("/api/auth/session").json["user"]["points"] == 150


def test_legacy_bcrypt_cookie_and_expired_session_compatibility(app, client):
    db = app.extensions["database"]
    token = "ab" * 32
    # Node bcrypt and Python bcrypt accept the same $2b$12$ hash format.
    hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12)).decode()

    def legacy(conn):
        user = insert(
            conn,
            "User",
            {"email": "legacy@example.com", "name": "Legacy user", "passwordHash": hashed},
        )
        insert(
            conn,
            "Session",
            {
                "tokenHash": hashlib.sha256(token.encode()).hexdigest(),
                "userId": user["id"],
                "expiresAt": datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1),
            },
        )

    db.run(legacy)
    client.set_cookie("vntravel", token)
    response = client.get("/api/auth/session")
    assert response.json["user"]["email"] == "legacy@example.com"
    assert (
        response.json["csrfToken"] == hashlib.sha256(f"vntravel-csrf:{token}".encode()).hexdigest()
    )
    for _ in range(7):
        # Each fresh client simulates a distinct browser/device.
        result = app.test_client().post(
            "/api/auth/signin",
            json={"email": "legacy@example.com", "password": PASSWORD},
            headers=HEADERS,
        )
        assert result.status_code == 200
    assert db.run(lambda conn: one(conn, 'SELECT count(*) AS n FROM "Session"'))["n"] == 5
    assert client.get("/api/auth/session").json["user"] is None
    db.run(
        lambda conn: conn.execute('UPDATE "Session" SET "expiresAt" = %s', (datetime(1970, 1, 1),))
    )
    assert client.get("/api/auth/session").json["user"] is None


def test_python_migrations_seed_preserve_existing_content(app):
    db = app.extensions["database"]
    db.run(migrate, serializable=False)
    db.run(seed)
    db.run(
        lambda conn: conn.execute(
            'UPDATE "Place" SET description = %s, article = %s, version = 2 WHERE id = 1601',
            ("Nội dung quản trị viên đã cập nhật", "Bài viết riêng"),
        )
    )
    db.run(migrate, serializable=False)
    db.run(seed)
    row = db.run(lambda conn: one(conn, 'SELECT * FROM "Place" WHERE id = 1601'))
    assert row["article"] == "Bài viết riêng"
    assert db.run(lambda conn: one(conn, 'SELECT count(*) AS n FROM "Place"'))["n"] == 105


def test_production_cookie_origin_headers_and_assets(database_url, tmp_path):
    app = create_app(
        database_url,
        {"PRODUCTION": True, "APP_URL": "https://travel.example", "ASSET_ROOT": tmp_path},
    )
    db = app.extensions["database"]
    try:
        db.run(lambda conn: conn.execute('TRUNCATE "User", "RateBucket" CASCADE'))
        client = app.test_client()
        body = {"name": "Production user", "email": "prod@example.com", "password": PASSWORD}
        assert client.post("/api/auth/signup", json=body, headers=HEADERS).status_code == 403
        response = client.post(
            "/api/auth/signup", json=body, headers={"Origin": "https://travel.example"}
        )
        assert response.status_code == 201
        cookie = response.headers["Set-Cookie"]
        assert all(
            part in cookie
            for part in ("__Host-vntravel=", "Secure", "HttpOnly", "SameSite=Lax", "Path=/")
        )
        assert "max-age=" in response.headers["Strict-Transport-Security"]
        assert "upgrade-insecure-requests" in response.headers["Content-Security-Policy"]
        (tmp_path / "dist").mkdir()
        (tmp_path / "dist/index.html").write_text("<h1>Travel</h1>", encoding="utf-8")
        (tmp_path / "public").mkdir()
        (tmp_path / "public/example.json").write_text("{}", encoding="utf-8")
        assert client.get("/", headers={"Accept": "text/html"}).status_code == 200
        assert client.get("/itineraries/shared", headers={"Accept": "text/html"}).status_code == 200
        assert client.get("/example.json").json == {}
        assert client.get("/api/not-found").status_code == 404
    finally:
        db.close()


@pytest.mark.parametrize(
    "points,tier",
    [
        (0, "BRONZE"),
        (199, "BRONZE"),
        (200, "SILVER"),
        (499, "SILVER"),
        (500, "GOLD"),
        (1000, "DIAMOND"),
    ],
)
def test_tiers(points, tier):
    assert tier_for(points) == tier


def test_vietnam_midnight_and_unicode_validation():
    assert vietnam_day(datetime(2026, 1, 1, 16, 59, 59, tzinfo=UTC)) == "2026-01-01"
    assert vietnam_day(datetime(2026, 1, 1, 17, 0, tzinfo=UTC)) == "2026-01-02"
    assert (
        credentials(
            {"name": "  Tên người dùng  ", "email": " TEST@example.com ", "password": "ắ" * 24},
            signup=True,
        )["email"]
        == "test@example.com"
    )
    with pytest.raises(HttpError):
        credentials(
            {"name": "Tên người dùng", "email": "test@example.com", "password": "ắ" * 25},
            signup=True,
        )
    overlapping = deepcopy(PLAN)
    overlapping["id"] = str(uuid4())
    overlapping["days"][0]["activities"] *= 2
    with pytest.raises(HttpError):
        itinerary_input(overlapping, create=True)


def test_cursor_errors_and_profile_update(app, client):
    auth = signup(client)
    updated = write(client, "/api/v1/profile", {"name": "Tên mới"}, auth, "PATCH")
    assert updated.json["name"] == "Tên mới"
    assert "email" not in updated.json
    assert client.get("/api/auth/session").json["user"]["name"] == "Tên mới"
    for value in [
        "bad",
        base64.urlsafe_b64encode(
            json.dumps({"id": "bad", "createdAt": "not-date"}).encode()
        ).decode(),
    ]:
        assert client.get("/api/v1/rewards?cursor=" + value).status_code == 400
    assert csrf_for("ab" * 32) != digest("ab" * 32)
