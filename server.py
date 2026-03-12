"""
FocusFlow Pro — Python Backend Server
Serves static files + auto-saves/loads data to/from JSON on disk.

Usage:
    cd ~/PycharmProjects/FocusFlow
    python3 server.py
    Then open http://localhost:3000 in your browser.
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
import json
import os
import sys
import shutil
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# --- Path resolution for PyInstaller frozen bundles ---
if getattr(sys, 'frozen', False):
    # Static files (HTML, JS, CSS) are bundled inside _MEIPASS (read-only)
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Data files ALWAYS live in a persistent user directory (both dev & frozen)
DATA_DIR = os.path.join(os.path.expanduser('~'), 'FocusFlowData')
os.makedirs(DATA_DIR, exist_ok=True)

app = Flask(__name__)

DATA_FILE = os.path.join(DATA_DIR, 'focusflow_data.json')
BACKUP_DIR = os.path.join(DATA_DIR, 'backups')

DEFAULT_STATE = {
    "tasks": [],
    "habits": [],
    "categories": [
        {"id": "Yazılım", "label": "Yazılım", "icon": "💻", "color": "#38bdf8"},
        {"id": "Spor", "label": "Spor", "icon": "🏃", "color": "#fb923c"},
        {"id": "Üniversite", "label": "Üniversite", "icon": "📚", "color": "#a78bfa"},
        {"id": "Genel", "label": "Genel", "icon": "📌", "color": "#64748b"},
    ],
    "streak": 0,
    "lastStreakDate": "",
    "badgeDates": {},
    "theme": "dark",
    "pomodoroSessions": 0,
    "deletedStack": [],
}


def load_data():
    """Load data from JSON file, return default if not found."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {**DEFAULT_STATE, **data}
        except (json.JSONDecodeError, IOError) as e:
            print(f"⚠️  Could not read data file: {e}")
    return DEFAULT_STATE.copy()


def save_data(data):
    """Save data to JSON file with atomic write."""
    tmp_file = DATA_FILE + '.tmp'
    try:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.move(tmp_file, DATA_FILE)
    except IOError as e:
        print(f"❌ Could not save data: {e}")
        if os.path.exists(tmp_file):
            os.remove(tmp_file)


def auto_backup():
    """Create a daily backup automatically."""
    if not os.path.exists(DATA_FILE):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    today = datetime.now().strftime('%Y-%m-%d')
    backup_file = os.path.join(BACKUP_DIR, f'focusflow_backup_{today}.json')
    if not os.path.exists(backup_file):
        shutil.copy2(DATA_FILE, backup_file)
        print(f"📦 Daily backup created: {backup_file}")
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.json')])
    while len(backups) > 7:
        os.remove(os.path.join(BACKUP_DIR, backups.pop(0)))


# ---- Static File Routes ----

@app.route('/')
def serve_index():
    return send_file(os.path.join(BASE_DIR, 'index.html'))


@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)


@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)


# ---- API Endpoints ----

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify(load_data())


@app.route('/api/data', methods=['POST'])
def post_data():
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Geçersiz veri"}), 400
    save_data(data)
    return jsonify({"status": "ok"})


@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    if not GEMINI_API_KEY:
        return jsonify({"message": "Lütfen ayarlardan (veya .env dosyasından) GEMINI_API_KEY yapılandırmasını tamamlayınız.", "actions": []}), 200
    
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({"error": "Geçersiz istek parametreleri.", "actions": []}), 400
    
    user_message = data['message']
    current_state = data.get('state', {})
    
    # Strip unnecessary info to save tokens
    mini_state = {
        "tasks": [{"id": t.get("id"), "title": t.get("title"), "dueDate": t.get("dueDate"), "list": t.get("list"), "completed": t.get("completed"), "priority": t.get("priority")} for t in current_state.get("tasks", [])],
        "categories": [c.get("id") for c in current_state.get("categories", [])],
        "habits": [{"id": h.get("id"), "name": h.get("name")} for h in current_state.get("habits", [])],
        "schedule": current_state.get("schedule", {})
    }
    
    prompt = f"""Sen FocusFlow Pro yönetim sisteminin entegre Yapay Zeka Asistanısın. 
Kullanıcının mevcut verileri aşağıdadır:
{json.dumps(mini_state, ensure_ascii=False)}

Kullanıcının ilettiği talep: "{user_message}"

Vereceğin yanıt kesinlikle JSON formatında olmalıdır. JSON şeması aşağıdaki gibidir:
{{
  "message": "Kullanıcıya iletilecek olan, resmi, profesyonel ve yardımsever bir tondaki metin cevabı.",
  "actions": [
    {{
      "type": "addTask" | "deleteTask" | "updateTask" | "addHabit" | "updateSchedule",
      "payload": {{ ... }}
    }}
  ]
}}

Aksiyon Tipleri ve Payload Örnekleri:
1. "addTask" -> payload: {{"title": "Görev adı", "category": "Kategori", "priority": "low | medium | high", "list": "daily | weekly"}}
2. "deleteTask" -> payload: {{"id": "silinecek-gorevin-id-si"}}
3. "updateTask" -> payload: {{"id": "guncellenecek-gorev-id", "updates": {{"title": "yeni ad", "priority": "low", "list": "daily"}}}} // Yalnızca değişen özellikler
4. "addHabit" -> payload: "Alışkanlık adı"
5. "updateSchedule" -> payload: {{"day": "pazartesi", "blockId": "08:30", "updates": {{"subject": "MATE134", "difficulty": "basit", "type": "ders"}}}} // Haftalık program yönetimi
6. "clearCompleted" -> payload: {{"list": "daily"}} // veya "weekly"
7. "addCategory" -> payload: {{"label": "Kategori Adı", "icon": "🎨", "color": "#hexKodu"}}
8. "deleteCategory" -> payload: {{"id": "Silinecek Kategori Adı"}}
9. "setTheme" -> payload: {{"theme": "dark"}} // dark, light, ocean, sunset, forest, rose, nord, dracula
10. "clearWeeklySchedule" -> payload: {{}} // Haftalık takvimi sıfırlar

Yetki ve Yönergeler: Sen FocusFlow sisteminin tam yetkili yöneticisisin. Kullanıcının uygulama verilerini (görevler, program, kategori, tema vb.) düzenleme taleplerini doğrudan yerine getirerek "actions" dizisine ekle. Birden fazla işlem belirtilirse, hepsini sırayla actions dizisine dahil et.
Herhangi bir işlem gerekmiyorsa "actions" dizisini boş bırak. Kullanıcının mesajlarına resmi, saygılı ve profesyonel bir dille yanıt ver. Kendinden bahsederken "FocusFlow Yapay Zeka Asistanı" olarak bahset.
Yanıtın yalnızca geçerli bir JSON objesi olmalı, markdown blokları (```json gibi) veya ekstra metin içermemelidir. Doğrudan süslü parantez ile başla.
"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Temizleme
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        result_json = json.loads(response_text)
        return jsonify(result_json)
    except Exception as e:
        print(f"Gemini API error: {e}")
        return jsonify({"message": "Yapay zeka sistemine ulaşılamadı, lütfen daha sonra tekrar deneyiniz.", "actions": []}), 500


if __name__ == '__main__':
    auto_backup()
    print("=" * 50)
    print("⚡ FocusFlow Pro Server Started")
    print("🌐 http://localhost:3000")
    print("💾 Data file:", DATA_FILE)
    print("=" * 50)
    app.run(debug=True, port=3000)
