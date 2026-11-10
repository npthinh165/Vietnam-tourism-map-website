"""Flask application with the original same-origin JSON API and SPA assets."""

import logging
import os
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.exceptions import BadRequest, HTTPException, RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix

from .database import ROOT, Database, one
from .domain import HttpError, credentials
from .security import load_session, rate_limit, require_admin, require_csrf


def create_app(database_url=None, config=None):
    app = Flask(__name__, static_folder=None)
    production = os.getenv("NODE_ENV") == "production"
    app.config.update(
        PRODUCTION=production,
        APP_URL=os.getenv("APP_URL", "http://localhost:3000"),
        MAX_CONTENT_LENGTH=256 * 1024,
        COOKIE_NAME="__Host-vntravel" if production else "vntravel",
        ASSET_ROOT=ROOT,
    )
    if config:
        app.config.update(config)
    production = app.config["PRODUCTION"]
    app.config["COOKIE_NAME"] = "__Host-vntravel" if production else "vntravel"
    origin = urlsplit(app.config["APP_URL"])
    if not origin.hostname or origin.scheme not in ("http", "https"):
        raise RuntimeError("APP_URL cần là origin HTTP/HTTPS hợp lệ.")
    if production and origin.scheme != "https":
        raise RuntimeError("APP_URL production cần sử dụng HTTPS.")
    allowed = {urlunsplit((origin.scheme, origin.netloc, "", "", ""))}
    if not production and origin.hostname in ("localhost", "127.0.0.1"):
        alternate = "127.0.0.1" if origin.hostname == "localhost" else "localhost"
        if origin.port:
            alternate += f":{origin.port}"
        allowed.add(urlunsplit((origin.scheme, alternate, "", "", "")))
    hops = int(os.getenv("TRUST_PROXY_HOPS", "0"))
    if hops < 0:
        raise RuntimeError("TRUST_PROXY_HOPS không được âm.")
    if hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops)
    db = Database(database_url or os.getenv("DATABASE_URL"))
    app.extensions["database"] = db
    app.json.ensure_ascii = False

    @app.before_request
    def protect_api():
        if not (request.path == "/api" or request.path.startswith("/api/")):
            return
        write = request.method not in ("GET", "HEAD", "OPTIONS")
        if write:
            supplied_origin = request.headers.get("Origin")
            local_same_origin = False
            if not production and supplied_origin == request.host_url.rstrip("/"):
                # Vite preserves Host when proxying requests from a LAN browser.
                # Only trust literal local IPs (or localhost), never arbitrary hosts.
                hostname = urlsplit(request.host_url).hostname
                try:
                    address = ip_address(hostname)
                    local_same_origin = address.is_private and not (
                        address.is_unspecified or address.is_multicast
                    )
                except ValueError:
                    local_same_origin = hostname == "localhost"
            if (
                supplied_origin not in allowed
                and not local_same_origin
                or request.headers.get("Sec-Fetch-Site") == "cross-site"
            ):
                raise HttpError(403, "Nguồn yêu cầu không được cho phép.")
            if request.mimetype != "application/json":
                raise HttpError(415, "Yêu cầu cần có định dạng JSON.")
            # Parse here to enforce payload limit and malformed JSON before handlers.
            g.body = request.get_json() if request.get_data() else {}
        if request.path == "/api/health":
            return
        load_session(db)
        if request.path.startswith("/api/admin/"):
            require_admin()
            if write:
                rate_limit(db, "admin-write", str(require_csrf()["id"]), 100, 60000)
        elif request.path.startswith("/api/v1/") and write:
            rate_limit(db, "write", str(require_csrf()["id"]), 100, 60000)
        if request.method == "POST" and request.path == "/api/auth/signup":
            rate_limit(db, "signup", request.remote_addr or "unknown", 5, 3600000)
            g.credentials = credentials(g.body, signup=True)
        elif request.method == "POST" and request.path in (
            "/api/auth/signin",
            "/api/auth/admin/signin",
        ):
            rate_limit(db, "signin-ip", request.remote_addr or "unknown", 30, 900000)
            g.credentials = credentials(g.body)
            rate_limit(db, "signin-email", g.credentials["email"], 10, 900000)

    @app.after_request
    def security_headers(response):
        response.headers.update(
            {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "SAMEORIGIN",
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Resource-Policy": "same-origin",
                "Origin-Agent-Cluster": "?1",
                "X-DNS-Prefetch-Control": "off",
                "X-Download-Options": "noopen",
                "X-Permitted-Cross-Domain-Policies": "none",
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
                + ("; upgrade-insecure-requests" if production else ""),
            }
        )
        if production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if request.path == "/api" or request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.vary.add("Cookie")
        return response

    @app.errorhandler(Exception)
    def handle_error(error):
        fields = None
        if isinstance(error, HttpError):
            status, message, fields = error.status, str(error), error.fields
        elif isinstance(error, RequestEntityTooLarge):
            status, message = 413, "Nội dung quá lớn."
        elif isinstance(error, BadRequest):
            status, message = 400, "JSON không hợp lệ."
        elif isinstance(
            error,
            (
                psycopg.errors.UniqueViolation,
                psycopg.errors.SerializationFailure,
                psycopg.errors.DeadlockDetected,
            ),
        ):
            status, message = (
                409,
                "Dữ liệu đã tồn tại hoặc vừa thay đổi. Vui lòng kiểm tra và thử lại.",
            )
        elif isinstance(error, psycopg.errors.ForeignKeyViolation):
            status, message = 404, "Nội dung không còn tồn tại."
        elif isinstance(error, HTTPException):
            status, message = (
                error.code,
                "Không tìm thấy API."
                if request.path.startswith("/api")
                else "Không tìm thấy trang.",
            )
        else:
            # Do not log parameters, credentials or database URLs.
            logging.getLogger(__name__).error(
                "API error: %s (%s)", type(error).__name__, getattr(error, "sqlstate", "")
            )
            status, message = 503, "Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại."
        body = {"error": message}
        if fields is not None:
            body["fields"] = fields
        response = jsonify(body)
        response.status_code = status
        if status == 429:
            response.headers["Retry-After"] = "900"
        return response

    @app.get("/api/health")
    def health():
        db.run(lambda conn: one(conn, "SELECT 1"), serializable=False)
        return {"status": "ok"}

    from .routes import register_routes

    register_routes(app, db)

    @app.get("/", defaults={"asset": ""})
    @app.get("/<path:asset>")
    def assets(asset):
        if asset == "api" or asset.startswith("api/"):
            raise HttpError(404, "Không tìm thấy API.")
        root = Path(app.config["ASSET_ROOT"])
        for folder in (root / "dist", root / "public"):
            resolved = (folder / asset).resolve()
            if resolved.is_relative_to(folder.resolve()) and resolved.is_file():
                return send_from_directory(folder, asset)
        if (root / "dist/index.html").is_file() and request.accept_mimetypes.accept_html:
            return send_from_directory(root / "dist", "index.html")
        raise HttpError(404, "Không tìm thấy trang.")

    return app
