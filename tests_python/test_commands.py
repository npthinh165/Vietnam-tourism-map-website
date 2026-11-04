import os
import queue
import subprocess
import sys
import threading
import urllib.request

import pytest

from backend.cli import create_admin
from backend.database import ROOT, insert, migrate, one
from backend.maintenance import cleanup


def test_create_admin_refuses_existing_email(app, monkeypatch, capsys):
    db = app.extensions["database"]
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("ADMIN_NAME", raising=False)
    create_admin(db, "admin@example.com")
    output = capsys.readouterr().out
    assert "Mật khẩu ngẫu nhiên" in output
    user = db.run(
        lambda conn: one(conn, 'SELECT * FROM "User" WHERE email = %s', ("admin@example.com",))
    )
    assert user["role"] == "ADMIN"
    with pytest.raises(RuntimeError, match="Email đã tồn tại"):
        create_admin(db, "admin@example.com")
    assert db.run(lambda conn: one(conn, 'SELECT count(*) AS n FROM "User"'))["n"] == 1


def test_cleanup_keeps_live_sessions(app):
    from datetime import UTC, datetime, timedelta

    db = app.extensions["database"]

    def setup(conn):
        user = insert(
            conn,
            "User",
            {"email": "cleanup@example.com", "name": "Cleanup", "passwordHash": "test-only"},
        )
        for token, age in [("a" * 64, -1), ("b" * 64, 1)]:
            expires = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=age)
            insert(
                conn, "Session", {"tokenHash": token, "userId": user["id"], "expiresAt": expires}
            )
            insert(conn, "RateBucket", {"key": token, "count": 1, "expiresAt": expires})
        cleanup(conn)

    db.run(setup)
    assert db.run(lambda conn: one(conn, 'SELECT count(*) AS n FROM "Session"'))["n"] == 1
    assert db.run(lambda conn: one(conn, 'SELECT count(*) AS n FROM "RateBucket"'))["n"] == 1


def test_migration_adopts_prisma_history_without_recreating_tables(app):
    db = app.extensions["database"]

    def baseline(conn):
        # Exercise adoption inside an isolated namespace, never on application tables.
        conn.execute('CREATE SCHEMA "legacy_baseline"')
        conn.execute('SET LOCAL search_path TO "legacy_baseline"')
        conn.execute(
            'CREATE TABLE "_prisma_migrations" (migration_name TEXT, finished_at TIMESTAMP, rolled_back_at TIMESTAMP)'
        )
        for path in sorted((ROOT / "prisma/migrations").glob("*/migration.sql")):
            conn.execute(path.read_text(encoding="utf-8-sig"), prepare=False)
            conn.execute(
                'INSERT INTO "_prisma_migrations" VALUES (%s, CURRENT_TIMESTAMP, NULL)',
                (path.parent.name,),
            )
        user = insert(
            conn,
            "User",
            {"email": "baseline@example.com", "name": "Keep user", "passwordHash": "keep-hash"},
        )
        migrate(conn)
        assert (
            one(conn, 'SELECT * FROM "User" WHERE id = %s', (user["id"],))["passwordHash"]
            == "keep-hash"
        )
        assert one(conn, 'SELECT count(*) AS n FROM "_PythonMigration"')["n"] == 4
        conn.execute('DROP SCHEMA "legacy_baseline" CASCADE')

    db.run(baseline, serializable=False)


def test_dev_command_runs_python_http_server(database_url):
    environment = {
        **os.environ,
        "DATABASE_URL": database_url,
        "NODE_ENV": "test",
        "APP_URL": "http://localhost:3000",
    }
    process = subprocess.Popen(
        [sys.executable, "-X", "utf8", "-m", "backend", "dev", "--api-only", "--port", "0"],
        cwd=ROOT,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    ready = queue.Queue()

    def read():
        for line in process.stdout:
            if line.startswith("Travel Python API: "):
                ready.put(line.strip().split(": ", 1)[1])

    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    try:
        url = ready.get(timeout=20)
        with urllib.request.urlopen(url + "/api/health", timeout=10) as response:
            assert response.status == 200
            assert b'"ok"' in response.read()
    finally:
        process.terminate()
        process.wait(timeout=15)
        reader.join(timeout=2)
        process.stdout.close()
        process.stderr.close()
