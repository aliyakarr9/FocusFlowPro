"""
TDAPP sunucusu.

Arayüz dosyalarını sunar, veriyi ~/TDAPPData altındaki JSON dosyasında tutar
ve asistan isteklerini Gemini'ye iletir.

    python3 server.py        ->  http://localhost:3000
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

# PyInstaller ile paketlendiğinde arayüz dosyaları _MEIPASS altındadır
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Veri her zaman kullanıcının ev klasöründe durur (paketli sürümde de)
DATA_DIR = os.path.join(os.path.expanduser('~'), 'TDAPPData')
DATA_FILE = os.path.join(DATA_DIR, 'tdapp_data.json')
BACKUP_DIR = os.path.join(DATA_DIR, 'backups')

# Uygulamanın eski adıyla (FocusFlow) tutulan veri
OLD_DATA_DIR = os.path.join(os.path.expanduser('~'), 'FocusFlowData')
OLD_PREFIX = 'focusflow_'


def migrate_old_data():
    """Eski klasördeki veriyi bir kez yeni klasöre kopyalar; eski klasöre dokunmaz."""
    if os.path.exists(DATA_DIR) or not os.path.isdir(OLD_DATA_DIR):
        return
    tmp_dir = DATA_DIR + '.tmp'
    shutil.rmtree(tmp_dir, ignore_errors=True)
    shutil.copytree(OLD_DATA_DIR, tmp_dir)
    for folder in (tmp_dir, os.path.join(tmp_dir, 'backups')):
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            if name.startswith(OLD_PREFIX) and name.endswith('.json'):
                os.replace(os.path.join(folder, name), os.path.join(folder, 'tdapp_' + name[len(OLD_PREFIX):]))
    os.replace(tmp_dir, DATA_DIR)
    print(f"Veriler {OLD_DATA_DIR} klasöründen {DATA_DIR} klasörüne kopyalandı.")


migrate_old_data()
os.makedirs(DATA_DIR, exist_ok=True)


app = Flask(__name__)


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
    """Veriyi dosyadan okur; dosya yoksa ya da bozuksa boş durumu döndürür."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {**DEFAULT_STATE, **data}
        except (json.JSONDecodeError, IOError) as e:
            print(f"Veri dosyası okunamadı: {e}")
    return DEFAULT_STATE.copy()


def save_data(data):
    """Veriyi önce geçici dosyaya yazar, sonra asıl dosyanın yerine koyar."""
    tmp_file = DATA_FILE + '.tmp'
    try:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.move(tmp_file, DATA_FILE)
    except IOError as e:
        print(f"Veri kaydedilemedi: {e}")
        if os.path.exists(tmp_file):
            os.remove(tmp_file)


def auto_backup():
    """Günde bir yedek alır, en yeni yedi yedeği tutar."""
    if not os.path.exists(DATA_FILE):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    today = datetime.now().strftime('%Y-%m-%d')
    backup_file = os.path.join(BACKUP_DIR, f'tdapp_backup_{today}.json')
    if not os.path.exists(backup_file):
        shutil.copy2(DATA_FILE, backup_file)
        print(f"Günlük yedek alındı: {backup_file}")
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.json')])
    while len(backups) > 7:
        os.remove(os.path.join(BACKUP_DIR, backups.pop(0)))


# Arayüz dosyaları

@app.route('/')
def serve_index():
    return send_file(os.path.join(BASE_DIR, 'index.html'))


@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)


@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)


@app.after_request
def no_stale_assets(response):
    """Arayüz dosyaları her açılışta sunucudan doğrulansın; eski sürüm önbellekte kalmasın."""
    if request.path == '/' or request.path.startswith(('/css/', '/js/')):
        response.headers['Cache-Control'] = 'no-cache'
    return response


# API

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


GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


DAY_NAMES_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

# İstemcinin uygulayabildiği eylemler (js/components/AIChat.js ile aynı liste)
CHAT_ACTION_TYPES = {
    "addTask", "updateTask", "completeTask", "deleteTask", "addSubtask", "moveToDaily",
    "clearCompleted", "addHabit", "deleteHabit", "addCategory", "deleteCategory",
    "addScheduleEntry", "updateSchedule", "deleteScheduleEntry", "clearWeeklySchedule",
    "setTheme",
}


def build_chat_state(current_state):
    """Modele gönderilecek durumu küçültür (yalnızca gereken alanlar)."""
    today = datetime.now().strftime('%Y-%m-%d')
    tasks = []
    for t in (current_state.get("tasks") or [])[:200]:
        tasks.append({
            "id": t.get("id"),
            "title": t.get("title"),
            "list": t.get("list"),
            "category": t.get("category"),
            "priority": t.get("priority"),
            "dueDate": t.get("dueDate") or None,
            "completed": bool(t.get("completed")),
            "recurrence": t.get("recurrence") or "none",
            "subtasks": [{"title": s.get("title"), "completed": bool(s.get("completed"))} for s in (t.get("subtasks") or [])],
        })
    habits = []
    for h in current_state.get("habits") or []:
        habits.append({
            "id": h.get("id"),
            "name": h.get("name"),
            "doneToday": bool((h.get("history") or {}).get(today)),
        })
    schedule = [
        {"id": e.get("id"), "day": e.get("day"), "time": e.get("time"), "activity": e.get("activity"),
         "category": e.get("category"), "priority": e.get("priority")}
        for e in (current_state.get("weeklySchedule") or [])
    ]
    return {
        "tasks": tasks,
        "categories": [c.get("id") for c in current_state.get("categories") or []],
        "habits": habits,
        "schedule": schedule,
        "theme": current_state.get("theme"),
        "accent": current_state.get("accent"),
        "streak": current_state.get("streak"),
        "xp": current_state.get("xp"),
    }


def build_chat_prompt(user_message, mini_state, history):
    now = datetime.now()
    today = now.strftime('%Y-%m-%d')
    weekday = DAY_NAMES_TR[now.weekday()]
    transcript = ""
    for turn in history:
        who = "Kullanıcı" if turn.get("role") == "user" else "Asistan"
        text = str(turn.get("text", ""))[:1500]
        if text:
            transcript += f"{who}: {text}\n"

    return f"""Sen TDAPP adlı görev ve odak uygulamasının içindeki asistansın. Kullanıcının verilerini görebilir ve aşağıdaki eylemlerle değiştirebilirsin.

Bugün: {today} ({weekday}). Saat: {now.strftime('%H:%M')}.

Kullanıcının verileri (JSON):
{json.dumps(mini_state, ensure_ascii=False)}

Önceki konuşma (en eski en üstte, boş olabilir):
{transcript or "(yok)"}
Kullanıcının yeni mesajı:
{json.dumps(user_message, ensure_ascii=False)}

Yanıtın YALNIZCA şu şemada geçerli bir JSON nesnesi olmalı:
{{"message": "kullanıcıya gösterilecek metin", "actions": [{{"type": "...", "payload": {{...}}}}]}}

Eylemler ve payload alanları:
- "addTask": {{"title": "...", "list": "daily" | "weekly", "category": "mevcut kategorilerden biri", "priority": "low" | "medium" | "high", "dueDate": "YYYY-MM-DD" veya boş, "recurrence": "none" | "daily" | "weekdays" | "weekly", "notes": "...", "subtasks": ["...", "..."]}} (yalnızca title zorunlu)
- "updateTask": {{"id": "görev id", "updates": {{"title", "category", "priority", "dueDate", "list", "recurrence", "notes" alanlarından değişenler}}}}
- "completeTask": {{"id": "görev id", "completed": true | false}}
- "deleteTask": {{"id": "görev id"}}
- "addSubtask": {{"id": "görev id", "title": "alt görev"}}
- "moveToDaily": {{"id": "haftalık listedeki görev id"}} (görevi bugünün listesine de ekler)
- "clearCompleted": {{"list": "daily" | "weekly"}}
- "addHabit": {{"name": "alışkanlık adı"}}
- "deleteHabit": {{"id": "alışkanlık id"}}
- "addCategory": {{"label": "ad", "color": "#rrggbb"}}
- "deleteCategory": {{"id": "kategori adı"}}
- "addScheduleEntry": {{"day": "Pazartesi" … "Pazar", "time": "08:30 - 09:20", "activity": "ders adı", "category": "kategori", "priority": "low" | "medium" | "high"}}
- "updateSchedule": {{"id": "program girdisi id", "updates": {{"activity", "category", "priority" alanlarından değişenler}}}}
- "deleteScheduleEntry": {{"id": "program girdisi id"}}
- "clearWeeklySchedule": {{}}
- "setTheme": {{"theme": "light" | "dark" | "system", "accent": "tomato" | "forest" | "ocean" | "amber" | "rose" | "graphite"}} (ikisinden biri yeterli)

Kurallar:
1. Kullanıcı bir değişiklik isterse ilgili eylemleri "actions" dizisine ekle; birden fazla istek varsa hepsini sırayla ekle. Yalnızca bilgi soruyorsa "actions" boş kalsın ve yanıtı verilerden çıkar.
2. Tarihleri bugüne göre hesapla ("yarın", "cuma", "haftaya" gibi) ve dueDate alanına YYYY-MM-DD olarak yaz. Tarih söylenmediyse dueDate ekleme.
3. priority zorluk demektir: low = kolay, medium = orta, high = zor.
4. Var olan bir görev, alışkanlık ya da program girdisi için mutlaka verilerdeki gerçek "id" değerini kullan; id uydurma. Hangi kayıt kastedildiği belirsizse eylem ekleme, kullanıcıya hangisini kastettiğini sor.
5. Kategori verilerde yoksa ve kullanıcı açıkça istemediyse yeni kategori oluşturma; en uygun mevcut kategoriyi seç.
6. Silme ve temizleme eylemlerini kullanıcı istediyse ekle; uygulama bunları uygulamadan önce kullanıcıdan onay alır, bu yüzden "sildim" deme, "silmek için onayını bekliyorum" gibi yaz.
7. "message" kısa, sade ve samimi Türkçe olsun; "sen" diye hitap et. Emoji, markdown işaretleri (*, #, ```), abartılı övgü ve resmî kalıplar kullanma. Liste gerekiyorsa her maddeyi yeni satıra "- " ile yaz.
8. Öneri istenirse (ör. "bugün ne yapmalıyım") geciken ve bugüne ait görevleri, zorluklarını ve alışkanlıkları dikkate alarak somut bir sıra öner.
"""


@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    if not GEMINI_API_KEY:
        return jsonify({
            "message": "Asistan için Gemini API anahtarı ayarlanmamış. Proje klasöründeki .env dosyasına GEMINI_API_KEY ekleyip uygulamayı yeniden başlat.",
            "actions": [],
            "configured": False,
        }), 200

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not str(data.get('message', '')).strip():
        return jsonify({"error": "Geçersiz istek.", "actions": []}), 400

    user_message = str(data['message']).strip()[:2000]
    current_state = data.get('state') if isinstance(data.get('state'), dict) else {}
    history = data.get('history') if isinstance(data.get('history'), list) else []
    history = [h for h in history if isinstance(h, dict)][-10:]

    prompt = build_chat_prompt(user_message, build_chat_state(current_state), history)

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        response_text = (response.text or "").strip()

        # Model yine de kod bloğu içinde dönerse temizle
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[-1] if "\n" in response_text else response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        result = json.loads(response_text)
        if not isinstance(result, dict):
            raise ValueError("JSON nesnesi bekleniyordu")

        actions = []
        for action in result.get("actions") or []:
            if isinstance(action, dict) and action.get("type") in CHAT_ACTION_TYPES:
                payload = action.get("payload")
                actions.append({"type": action["type"], "payload": payload if isinstance(payload, (dict, str)) else {}})

        return jsonify({"message": str(result.get("message") or "").strip(), "actions": actions})
    except Exception as e:
        print(f"Gemini isteği başarısız: {e}")
        return jsonify({"message": "Asistana şu an ulaşılamadı. Biraz sonra yeniden dene.", "actions": []}), 502


if __name__ == '__main__':
    auto_backup()
    print("TDAPP: http://localhost:3000")
    print("Veri dosyası:", DATA_FILE)
    # Hata ayıklama modu yalnızca istenirse açılır: FLASK_DEBUG=1 python3 server.py
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", port=3000)
