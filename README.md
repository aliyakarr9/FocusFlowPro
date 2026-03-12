# ⚡ FocusFlow Pro — Akıllı Görev Yöneticisi

Modern görev yönetimi ve odaklanma aracı. Günlük & haftalık planlama, Pomodoro zamanlayıcı, alışkanlık takibi, analiz paneli ve yapay zeka asistanı.

## ✨ Özellikler

- 📋 **Günlük & Haftalık Görev Yönetimi** — Görevleri kategorilere ayırın, öncelik belirleyin
- 🍅 **Pomodoro Zamanlayıcı** — Odaklanma oturumları ile verimli çalışın
- 📅 **Haftalık Program** — Ders ve aktivitelerinizi planlayın
- 🧘 **Alışkanlık Takibi** — Günlük alışkanlıklarınızı takip edin
- 📊 **Analiz Paneli** — Kategori bazlı istatistikler ve ilerleme grafikleri
- 🏆 **Rozet & XP Sistemi** — Görevleri tamamlayarak XP kazanın ve seviyelenin
- 🎯 **Günlük Meydan Okumalar** — Her gün farklı görevlerle bonus XP kazanın
- 🤖 **AI Asistan** — Gemini destekli yapay zeka ile görev yönetimi
- 🎨 **8 Farklı Tema** — Dark, Light, Ocean, Sunset, Forest, Rose, Nord, Dracula

## 🚀 Kurulum

### Gereksinimler

- Python 3.10+
- [Google Gemini API Anahtarı](https://aistudio.google.com/apikey) (AI Asistan için)

### Adımlar

```bash
# 1. Projeyi indirin
git clone https://github.com/KULLANICI_ADI/FocusFlow.git
cd FocusFlow

# 2. Sanal ortam oluşturun (önerilir)
python3 -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows

# 3. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 4. API anahtarınızı ayarlayın
cp .env.example .env
# .env dosyasını açıp GEMINI_API_KEY değerini yapıştırın

# 5. Sunucuyu başlatın
python3 server.py
```

Tarayıcınızda **http://localhost:3000** adresini açın. 🎉

> **Not:** AI Asistan özelliğini kullanmak için `.env` dosyasına geçerli bir Gemini API anahtarı eklemeniz gerekmektedir. Bu özellik olmadan da uygulama sorunsuz çalışır.

## 🖥️ Masaüstü Uygulaması (Opsiyonel)

Tarayıcı yerine bağımsız bir masaüstü penceresi kullanmak isterseniz:

```bash
pip install pywebview
python3 desktop_app.py
```

## 🛠️ Teknolojiler

| Katman | Teknoloji |
|---|---|
| **Backend** | Python, Flask |
| **Frontend** | Vanilla JS (ES Modules), HTML5, CSS3 |
| **AI** | Google Gemini API |
| **Masaüstü** | pywebview |
| **Veri Saklama** | JSON (`~/FocusFlowData/`) |

## 📁 Proje Yapısı

```
FocusFlow/
├── server.py           # Flask backend sunucu
├── desktop_app.py      # Masaüstü uygulama başlatıcı
├── index.html          # Ana HTML sayfası
├── css/
│   ├── style.css       # Ana stil dosyası
│   └── ai-chat.css     # AI sohbet widget stilleri
├── js/
│   ├── app.js          # Ana uygulama kontrolcüsü
│   ├── store.js        # Durum yönetimi (State Management)
│   ├── components/     # UI bileşenleri
│   └── utils/          # Yardımcı fonksiyonlar
├── requirements.txt    # Python bağımlılıkları
└── .env.example        # Ortam değişkenleri şablonu
```

## 📄 Lisans

MIT License
