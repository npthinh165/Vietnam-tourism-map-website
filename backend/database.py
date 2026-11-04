"""PostgreSQL access using the existing tables; no data conversion is needed."""

import hashlib
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, NullConnectionPool

ROOT = Path(__file__).resolve().parent.parent


def connection_options(url):
    if not url:
        raise RuntimeError("Cần cấu hình DATABASE_URL.")
    parts = urlsplit(url)
    if parts.scheme not in ("postgres", "postgresql"):
        raise RuntimeError("DATABASE_URL cần là địa chỉ PostgreSQL.")
    params = dict(parse_qsl(parts.query))
    schema = params.pop("schema", "public")
    size = int(params.pop("connection_limit", "5"))
    params.pop("pool_timeout", None)
    params.pop("pgbouncer", None)
    cleaned = urlunsplit(parts._replace(query=urlencode(params)))
    return cleaned, schema, max(1, min(size, 20))


class Database:
    def __init__(self, url):
        cleaned, schema, size = connection_options(url)

        def configure(conn):
            conn.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
            conn.execute("SET TIME ZONE 'UTC'")
            conn.commit()

        # Local PGlite sessions must be released after each transaction; its
        # protocol adapter cannot reliably reuse psycopg sessions after errors.
        pool_class = NullConnectionPool if size == 1 else ConnectionPool
        self.pool = pool_class(
            cleaned,
            min_size=0,
            max_size=size,
            timeout=15,
            open=True,
            kwargs={"row_factory": dict_row, "prepare_threshold": None, "connect_timeout": 10},
            configure=configure,
        )

    def run(self, work, serializable=True):
        for attempt in range(5):
            try:
                with self.pool.connection() as conn:
                    with conn.transaction():
                        if serializable:
                            conn.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                        return work(conn)
            except (psycopg.errors.SerializationFailure, psycopg.errors.DeadlockDetected):
                if attempt == 4:
                    raise
                time.sleep(0.01 * (attempt + 1))

    def close(self):
        self.pool.close()


def one(conn, query, params=()):
    return conn.execute(query, params).fetchone()


def all_rows(conn, query, params=()):
    return conn.execute(query, params).fetchall()


def insert(conn, table, fields, conflict=""):
    # Identifiers only originate from internal code. Values are always bound parameters.
    data = dict(fields)
    if table in {
        "User",
        "Post",
        "Comment",
        "Review",
        "CheckIn",
        "PointEntry",
        "ItineraryDay",
        "Activity",
    }:
        data.setdefault("id", str(uuid4()))
    if table in {"Post", "Comment", "Review", "Itinerary"}:
        data.setdefault("updatedAt", datetime.now(UTC).replace(tzinfo=None))
    query = sql.SQL("INSERT INTO {} ({}) VALUES ({}) {} RETURNING *").format(
        sql.Identifier(table),
        sql.SQL(", ").join(map(sql.Identifier, data)),
        sql.SQL(", ").join(sql.Placeholder() for _ in data),
        sql.SQL(conflict),
    )
    return one(conn, query, list(data.values()))


def update(conn, table, fields, where, params):
    data = dict(fields)
    if table in {"Post", "Comment", "Review", "Itinerary"}:
        data["updatedAt"] = datetime.now(UTC).replace(tzinfo=None)
    assignments = sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(key)) for key in data)
    return one(
        conn,
        sql.SQL("UPDATE {} SET {} WHERE {} RETURNING *").format(
            sql.Identifier(table), assignments, sql.SQL(where)
        ),
        [*data.values(), *params],
    )


def migrate(conn):
    """Apply SQL migrations and recognize both Prisma and existing local history."""
    directory = ROOT / "prisma" / "migrations"
    # Serialize schema changes across Python deployment processes.
    conn.execute("SELECT pg_advisory_xact_lock(74626191)")
    conn.execute(
        'CREATE TABLE IF NOT EXISTS "_PythonMigration" ("name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL)'
    )
    known = {
        row["name"]: row["checksum"] for row in all_rows(conn, 'SELECT * FROM "_PythonMigration"')
    }
    legacy = set()
    if one(conn, "SELECT to_regclass('\"_LocalMigration\"') AS name")["name"]:
        legacy.update(row["name"] for row in all_rows(conn, 'SELECT "name" FROM "_LocalMigration"'))
    if one(conn, "SELECT to_regclass('\"_prisma_migrations\"') AS name")["name"]:
        rows = all_rows(conn, 'SELECT * FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL')
        if any(not row["finished_at"] for row in rows):
            raise RuntimeError("Có migration Prisma chưa hoàn tất. Cần xử lý migration đó trước.")
        legacy.update(row["migration_name"] for row in rows)
    for file in sorted(directory.glob("*/migration.sql")):
        name = file.parent.name
        content = file.read_text(encoding="utf-8-sig").replace("\r\n", "\n").encode("utf-8")
        checksum = hashlib.sha256(content).hexdigest()
        if name in known:
            if known[name] != checksum:
                raise RuntimeError(f"Migration đã áp dụng bị thay đổi: {name}")
            continue
        if name not in legacy:
            conn.execute(content.decode("utf-8"), prepare=False)
        conn.execute('INSERT INTO "_PythonMigration" VALUES (%s, %s)', (name, checksum))


def seed(conn):
    from .domain import CATALOG

    for place in CATALOG["places"]:
        insert(
            conn,
            "Place",
            {
                "id": place["location_id"],
                "provinceId": place["province_id"],
                **{
                    key: place[key]
                    for key in (
                        "name",
                        "lat",
                        "lng",
                        "category",
                        "season",
                        "address",
                        "description",
                    )
                },
                "article": place.get("article", ""),
            },
            "ON CONFLICT (id) DO NOTHING",
        )
