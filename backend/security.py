"""Database sessions, CSRF, rate limits and public/private projections."""

import base64
import hashlib
import hmac
import json
import re
import time
from datetime import UTC, datetime
from uuid import UUID

from flask import current_app, g, request

from .database import all_rows, one
from .domain import HttpError, uuid

MEMBER_FIELDS = ("id", "name", "points", "tier")
USER_FIELDS = (*MEMBER_FIELDS, "email", "role")


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def csrf_for(token):
    return digest(f"vntravel-csrf:{token}")


def read_token():
    value = request.cookies.get(current_app.config["COOKIE_NAME"], "")
    return value if re.fullmatch(r"[a-f0-9]{64}", value) else None


def member(user):
    return {key: user[key] for key in MEMBER_FIELDS}


def session_user(user):
    return {key: user[key] for key in USER_FIELDS}


def load_session(db):
    g.user = None
    g.token = read_token()
    if g.token:
        row = db.run(
            lambda conn: one(
                conn,
                """SELECT u.* FROM "Session" s
            JOIN "User" u ON u.id = s."userId"
            WHERE s."tokenHash" = %s AND s."expiresAt" > CURRENT_TIMESTAMP""",
                (digest(g.token),),
            ),
            serializable=False,
        )
        if row:
            g.user = session_user(row)


def require_user():
    if not g.user:
        raise HttpError(401, "Vui lòng đăng nhập để tiếp tục.")
    return g.user


def require_admin():
    user = require_user()
    if user["role"] != "ADMIN":
        raise HttpError(403, "Tài khoản không có quyền quản trị.")
    return user


def require_csrf():
    user = require_user()
    supplied = request.headers.get("X-CSRF-Token", "")
    if not re.fullmatch(r"[a-f0-9]{64}", supplied) or not hmac.compare_digest(
        supplied, csrf_for(g.token)
    ):
        raise HttpError(403, "Phiên biểu mẫu đã thay đổi. Vui lòng tải lại trang.")
    return user


def rate_limit(db, scope, identity, maximum, window_ms):
    window = int(time.time() * 1000) // window_ms
    key = digest(f"{scope}:{identity}:{window}")
    expires = datetime.fromtimestamp((window + 1) * window_ms / 1000, UTC).replace(tzinfo=None)
    # Commit even when the subsequent request fails validation or authentication.
    count = db.run(
        lambda conn: one(
            conn,
            """INSERT INTO "RateBucket" (key, count, "expiresAt")
        VALUES (%s, 1, %s) ON CONFLICT (key) DO UPDATE
        SET count = "RateBucket".count + 1 RETURNING count""",
            (key, expires),
        )["count"]
    )
    if count > maximum:
        raise HttpError(429, "Bạn thao tác quá nhanh. Vui lòng thử lại sau.")


def json_value(value):
    if isinstance(value, datetime):
        if value.tzinfo:
            value = value.astimezone(UTC).replace(tzinfo=None)
        return value.isoformat(timespec="milliseconds") + "Z"
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [json_value(item) for item in value]
    return value


def paginated(conn, table, where="TRUE", params=()):
    # table/where are fixed internal SQL fragments; query data stays parameterized.
    params = list(params)
    raw = request.args.get("cursor")
    if raw is not None:
        try:
            if len(raw) > 300:
                raise ValueError()
            cursor = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
            identifier = uuid(cursor["id"])
            created = datetime.fromisoformat(cursor["createdAt"].replace("Z", "+00:00"))
            if created.tzinfo:
                created = created.astimezone(UTC).replace(tzinfo=None)
        except (ValueError, TypeError, KeyError, HttpError):
            raise HttpError(400, "Con trỏ phân trang không hợp lệ.") from None
        where += ' AND ("createdAt" < %s OR ("createdAt" = %s AND id < %s))'
        params.extend([created, created, identifier])
    rows = all_rows(
        conn,
        f'SELECT * FROM "{table}" WHERE {where} ORDER BY "createdAt" DESC, id DESC LIMIT 21',
        params,
    )
    items = rows[:20]
    next_cursor = None
    if len(rows) > 20:
        last = json_value(items[-1])
        value = json.dumps({"id": last["id"], "createdAt": last["createdAt"]}).encode()
        next_cursor = base64.urlsafe_b64encode(value).decode().rstrip("=")
    return {"items": items, "nextCursor": next_cursor}
