import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import pytest
from psycopg import sql

from backend.app import create_app
from backend.cli import local_database
from backend.database import Database, migrate


@pytest.fixture(scope="session")
def database_url():
    configured = os.getenv("TEST_DATABASE_URL")
    if configured:
        # Use an isolated schema on an explicitly configured test database.
        # Never use DATABASE_URL, which may contain the user's application data.
        admin = Database(configured)
        schema = "test_" + uuid4().hex
        admin.run(
            lambda conn: conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        )
        parts = urlsplit(configured)
        query = dict(parse_qsl(parts.query))
        query["schema"] = schema
        url = urlunsplit(parts._replace(query=urlencode(query)))
        db = Database(url)
        try:
            db.run(migrate, serializable=False)
            yield url
        finally:
            db.close()
            admin.run(
                lambda conn: conn.execute(
                    sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
                )
            )
            admin.close()
        return
    with local_database(memory=True) as url:
        db = Database(url)
        try:
            db.run(migrate, serializable=False)
        finally:
            db.close()
        yield url


@pytest.fixture
def app(database_url):
    app = create_app(database_url, {"TESTING": True})
    db = app.extensions["database"]
    db.run(lambda conn: conn.execute('TRUNCATE "User", "Place", "RateBucket" CASCADE'))
    yield app
    db.close()


@pytest.fixture
def client(app):
    return app.test_client()
