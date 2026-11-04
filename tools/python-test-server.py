"""Isolated HTTP process used by the existing TypeScript contract tests."""

import os
import sys
import threading
from pathlib import Path

from werkzeug.serving import make_server

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.app import create_app  # noqa: E402

app = create_app(os.environ["DATABASE_URL"])
server = make_server("127.0.0.1", 0, app, threaded=True)


def stop_on_input():
    sys.stdin.readline()
    server.shutdown()


threading.Thread(target=stop_on_input, daemon=True).start()
print(f"PYTHON_API_PORT={server.server_port}", flush=True)
try:
    server.serve_forever()
finally:
    server.server_close()
    app.extensions["database"].close()
