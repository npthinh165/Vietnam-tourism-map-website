"""Python commands for development, production, migrations, seed and admin creation."""

import argparse
import json
import os
import queue
import secrets
import shutil
import signal
import subprocess
import sys
import threading
from contextlib import contextmanager

import bcrypt
from dotenv import load_dotenv
from werkzeug.serving import make_server

from .database import ROOT, Database, insert, migrate, one, seed
from .domain import credentials
from .maintenance import maintenance


@contextmanager
def local_database(memory=False):
    node = shutil.which("node")
    if not node:
        raise RuntimeError(
            "Cần Node.js để chạy database PGlite local hoặc cấu hình PostgreSQL qua DATABASE_URL."
        )
    child = subprocess.Popen(
        [node, "--import", "tsx", "tools/python-database.mjs", *(["--memory"] if memory else [])],
        cwd=ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    ready = queue.Queue()

    def read_output():
        for line in child.stdout:
            try:
                payload = json.loads(line)
                if "databaseUrl" in payload:
                    ready.put(payload["databaseUrl"])
            except (ValueError, TypeError):
                print(line.rstrip(), flush=True)
        ready.put(None)

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    try:
        try:
            url = ready.get(timeout=45)
        except queue.Empty:
            raise RuntimeError("Database local chưa khởi động được sau 45 giây.") from None
        if not url:
            raise RuntimeError(
                "Không thể khởi động database local. Kiểm tra tiến trình dev cũ và npm ci."
            )
        yield url
    finally:
        if child.poll() is None:
            try:
                child.stdin.write("close\n")
                child.stdin.flush()
                child.wait(timeout=10)
            except (OSError, subprocess.TimeoutExpired):
                child.terminate()
                child.wait(timeout=10)
        child.stdin.close()
        reader.join(timeout=2)
        child.stdout.close()


@contextmanager
def configured_database(allow_local=False):
    url = os.getenv("DATABASE_URL")
    if url:
        yield url, False
    elif allow_local and os.getenv("NODE_ENV") != "production":
        with local_database() as local_url:
            yield local_url, True
    else:
        raise RuntimeError("Cần cấu hình DATABASE_URL PostgreSQL trước khi chạy lệnh này.")


def create_admin(db, email):
    generated = not os.getenv("ADMIN_PASSWORD")
    data = credentials(
        {
            "email": os.getenv("ADMIN_EMAIL") or email,
            "name": os.getenv("ADMIN_NAME", "Quản trị viên"),
            "password": os.getenv("ADMIN_PASSWORD") or secrets.token_urlsafe(24),
        },
        signup=True,
    )

    def create(conn):
        if one(conn, 'SELECT id FROM "User" WHERE email = %s', (data["email"],)):
            raise RuntimeError(
                "Email đã tồn tại. Lệnh này chỉ tạo admin mới, không sửa tài khoản hiện có."
            )
        insert(
            conn,
            "User",
            {
                "email": data["email"],
                "name": data["name"],
                "role": "ADMIN",
                "passwordHash": bcrypt.hashpw(
                    data["password"].encode(), bcrypt.gensalt(12)
                ).decode(),
            },
        )

    db.run(create)
    print(f"Đã tạo admin: {data['email']}")
    if generated:
        print(f"Mật khẩu ngẫu nhiên (lưu lại ngay): {data['password']}")


def development(url, api_only, host, port):
    from .app import create_app

    app = create_app(url)
    server = make_server(host, port, app, threaded=True)
    frontend = None
    try:
        if not api_only:
            frontend = subprocess.Popen(
                [
                    shutil.which("node") or "node",
                    "node_modules/vite/bin/vite.js",
                    "--host=0.0.0.0",
                    "--port=3000",
                    "--strictPort",
                ],
                cwd=ROOT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        print(f"Travel Python API: http://{host}:{server.server_port}", flush=True)
        server.timeout = 0.5
        with maintenance(app.extensions["database"]):
            while frontend is None or frontend.poll() is None:
                server.handle_request()
        if frontend.returncode:
            raise RuntimeError("Vite không khởi động được. Kiểm tra cổng 3000 và npm ci.")
    finally:
        server.server_close()
        if frontend and frontend.poll() is None:
            frontend.terminate()
            frontend.wait(timeout=10)
        app.extensions["database"].close()


def main(argv=None):
    def terminate(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, terminate)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description="Bản đồ Du lịch Việt Nam — Python")
    commands = parser.add_subparsers(dest="command", required=True)
    dev = commands.add_parser("dev", help="Chạy API Python và giao diện Vite")
    dev.add_argument("--api-only", action="store_true")
    dev.add_argument("--port", type=int, default=int(os.getenv("PORT", "3002")))
    dev.add_argument("--host", default="127.0.0.1")
    commands.add_parser("serve", help="Chạy máy chủ WSGI production")
    commands.add_parser("migrate", help="Áp dụng migration PostgreSQL, giữ dữ liệu hiện có")
    commands.add_parser("seed", help="Bổ sung danh mục điểm đến chưa có")
    preview = commands.add_parser("preview", help="Xem bản build với database tạm trong RAM")
    preview.add_argument("--port", type=int, default=3302)
    admin = commands.add_parser("create-admin", help="Tạo quản trị viên mới")
    admin.add_argument("email", nargs="?")
    args = parser.parse_args(argv)
    if args.command == "preview":
        if os.getenv("NODE_ENV") == "production":
            parser.error("Preview chỉ dành cho kiểm tra local.")
        os.environ["APP_URL"] = f"http://localhost:{args.port}"
        with local_database(memory=True) as url:
            db = Database(url)
            try:
                db.run(migrate, serializable=False)
                db.run(seed)
            finally:
                db.close()
            development(url, True, "127.0.0.1", args.port)
        return
    if args.command == "dev" and os.getenv("NODE_ENV") == "production":
        parser.error("Dùng serve với PostgreSQL khi triển khai production.")
    with configured_database(allow_local=args.command in ("dev", "create-admin")) as (url, local):
        db = Database(url)
        try:
            db.run(lambda conn: one(conn, "SELECT 1"), serializable=False)
            if local or args.command == "migrate":
                db.run(migrate, serializable=False)
            if local or args.command == "seed":
                db.run(seed)
            if args.command == "create-admin":
                create_admin(db, args.email)
            elif args.command in ("migrate", "seed"):
                print(
                    "Đã hoàn tất migration."
                    if args.command == "migrate"
                    else "Đã nạp 105 điểm đến; giữ nội dung đã có."
                )
        finally:
            db.close()
        if args.command == "dev":
            development(url, args.api_only, args.host, args.port)
        elif args.command == "serve":
            from waitress import serve

            from .app import create_app

            app = create_app(url)
            try:
                with maintenance(app.extensions["database"]):
                    serve(
                        app,
                        host=os.getenv("HOST", "127.0.0.1"),
                        port=int(os.getenv("PORT", "3002")),
                        max_request_body_size=256 * 1024,
                        clear_untrusted_proxy_headers=False,
                    )
            finally:
                app.extensions["database"].close()


if __name__ == "__main__":
    main()
