"""
app.py - Flask backend for AI Vault 2.0 with Razorpay Integration
"""
import math
import os
import sqlite3
import razorpay
import hmac
import hashlib

from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "aivault.db")

DEFAULT_LIMIT = 20
MAX_LIMIT = 100

app = Flask(__name__)

# --- RAZORPAY SETUP (Vercel Environment Variables se aayengi) ---
RAZORPAY_KEY_ID = os.environ.get("rzp_live_TxM8cvGEhK1785")
RAZORPAY_KEY_SECRET = os.environ.get("rzp_live_TxM8cvGEhK1785,W5G6JWYHmAEDmf2RyfqBrlb1")

# Client initialize karo (agar keys nahi hain toh error handle karega)
client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def get_db():
    # Vercel read-only filesystem ke liye mode=ro zaroori hai
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def to_int(value, default, minimum=1, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    number = max(number, minimum)
    if maximum is not None:
        number = min(number, maximum)
    return number


def escape_like(text):
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/prompts", methods=["GET"])
def api_prompts():
    if not os.path.exists(DB_PATH):
        return jsonify(error="Database not found."), 500

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
            total = conn.execute(f"SELECT COUNT(*) FROM prompts {where_sql}", params).fetchone()[0]
            rows = conn.execute(
                f"SELECT id, category, title, prompt FROM prompts {where_sql} ORDER BY id ASC LIMIT ? OFFSET ?",
                params + [limit, offset],
            ).fetchall()
            categories = [r["category"] for r in conn.execute("SELECT DISTINCT category FROM prompts ORDER BY category COLLATE NOCASE").fetchall()]
        finally:
            conn.close()
    except sqlite3.Error as exc:
        return jsonify(error=f"Database error: {exc}"), 500

    return jsonify(
        data=[dict(r) for r in rows],
        total=total,
        total_pages=math.ceil(total / limit) if total else 0,
        categories=categories,
        page=page,
    )


# --- RAZORPAY ROUTES (Naya Add Kiya Hai) ---

@app.route("/api/create-order", methods=["POST"])
def create_order():
    if not client:
        return jsonify(error="Razorpay keys missing in environment variables"), 500

    try:
        data = request.json
        amount = int(data.get('amount', 49)) * 100 # ₹49 ko paise me convert kiya
        
        order_data = {
            'amount': amount,
            'currency': 'INR',
            'receipt': f'receipt_{os.urandom(4).hex()}',
            'payment_capture': 1 
        }
        order = client.order.create(data=order_data)
        
        return jsonify({
            "id": order['id'],
            "amount": order['amount'],
            "currency": order['currency']
        })
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    if not client:
        return jsonify(error="Razorpay keys missing"), 500

    try:
        data = request.json
        order_id = data.get('razorpay_order_id')
        payment_id = data.get('razorpay_payment_id')
        signature = data.get('razorpay_signature')

        # Signature verify karna
        generated_signature = hmac.new(
            bytes(RAZORPAY_KEY_SECRET, 'utf-8'),
            bytes(order_id + "|" + payment_id, 'utf-8'),
            hashlib.sha256
        ).hexdigest()

        if generated_signature == signature:
            # Payment Successful!
            return jsonify({"status": "success", "message": "Payment verified!"})
        else:
            return jsonify({"status": "failure", "message": "Invalid signature"}), 400
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)