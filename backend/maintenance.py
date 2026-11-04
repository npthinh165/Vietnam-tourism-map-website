"""Periodic removal of expired authentication and rate-limit records."""

import logging
import threading
from contextlib import contextmanager


def cleanup(conn):
    conn.execute('DELETE FROM "Session" WHERE "expiresAt" < CURRENT_TIMESTAMP')
    conn.execute('DELETE FROM "RateBucket" WHERE "expiresAt" < CURRENT_TIMESTAMP')


@contextmanager
def maintenance(db):
    stop = threading.Event()

    def worker():
        while not stop.wait(3600):
            try:
                db.run(cleanup)
            except Exception:
                logging.getLogger(__name__).warning("Session cleanup temporarily unavailable.")

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        thread.join(timeout=20)
