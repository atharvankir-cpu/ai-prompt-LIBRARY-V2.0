"""
app.py - Flask backend for AI Vault 2.0
Run:  python app.py   ->   http://127.0.0.1:5000
"""
import math
import os
import sqlite3

from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "aivault.db")

DEFAULT_LIMIT = 20
MAX_LIMIT = 100

app = Flask(__name__)


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def to_int(value, default, minimum=1, maximum=None):
    """Safely parse an int from query params and clamp it into a valid range."""
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    number = max(number, minimum)
    if maximum is not None:
        number = min(number, maximum)
    return number


def escape_like(text):
    """Escape LIKE wildcards so user input like '50%' is searched literally."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/prompts", methods=["GET"])
def api_prompts():
    if not os.path.exists(DB_PATH):
        return jsonify(error="Database not found. Run 'python setup_db.py' first."), 500

    page = to_int(request.args.get("page"), 1)
    limit = to_int(request.args.get("limit"), DEFAULT_LIMIT, maximum=MAX_LIMIT)
    category = (request.args.get("category") or "All").strip()
    search = (request.args.get("search") or "").strip()

    where_clauses = []
    params = []

    if category and category.lower() != "all":
        where_clauses.append("category = ?")
        params.append(category)

    if search:
        pattern = f"%{escape_like(search)}%"
        where_clauses.append("(title LIKE ? ESCAPE '\\' OR prompt LIKE ? ESCAPE '\\')")
        params.extend([pattern, pattern])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    offset = (page - 1) * limit

    try:
        conn = get_db()
        try:
            total = conn.execute(
                f"SELECT COUNT(*) FROM prompts {where_sql}", params
            ).fetchone()[0]

            rows = conn.execute(
                f"""
                SELECT id, category, title, prompt
                FROM prompts
                {where_sql}
                ORDER BY id ASC
                LIMIT ? OFFSET ?
                """,
                params + [limit, offset],
            ).fetchall()

            categories = [
                r["category"]
                for r in conn.execute(
                    "SELECT DISTINCT category FROM prompts ORDER BY category COLLATE NOCASE"
                ).fetchall()
            ]
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app.logger.exception("Database error")
        return jsonify(error=f"Database error: {exc}"), 500

    return jsonify(
        data=[dict(r) for r in rows],
        total=total,
        total_pages=math.ceil(total / limit) if total else 0,
        categories=categories,
        page=page,
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
