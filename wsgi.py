"""
WSGI Entrypoint for NexusEdu AI Platform.
Enables high-performance production deployment across Gunicorn, Waitress, and Cloud Services.
"""
import os
from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
