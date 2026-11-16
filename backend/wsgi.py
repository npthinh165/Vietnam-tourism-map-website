"""WSGI entrypoint used by production hosts such as Render."""

from .app import create_app

app = create_app()
