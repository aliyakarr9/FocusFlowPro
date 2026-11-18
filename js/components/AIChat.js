import store from '../store.js';

export function renderAIChatWidget() {
    const widgetHtml = `
      <div id="ai-chat-container" class="ai-chat-container">
        <!-- Chat Window -->
        <div id="ai-chat-window" class="ai-chat-window hidden">
          <div class="ai-chat-header">
            <h3>🤖 AI Asistan</h3>
            <button id="ai-chat-close" class="ai-chat-close">&times;</button>
          </div>
          <div id="ai-chat-messages" class="ai-chat-messages">
            <div class="message ai-message">
              Merhaba, ben FocusFlow Yapay Zeka Asistanı.<br><br>
              Uygulamanızı ve iş akışınızı yönetmek için buradayım. İşlemlerinizin hızlıca gerçekleştirilmesi için doğrudan komutlar verebilirsiniz. Örnek kullanımlar:<br><br>
              📌 <b>Görev Yönetimi:</b> "Yarına yüksek öncelikli 'Matematik Çalış' adında bir Üniversite görevi ekle" veya "Tamamlanmış tüm günlük görevleri sil."<br>
              🎨 <b>Özelleştirme:</b> "Arayüz temasını ocean olarak değiştir" veya "Müzik adıyla yeni bir kategori oluştur."<br>
              📅 <b>Program Yönetimi:</b> "Haftalık takvimimi sıfırla" veya "Pazartesi günü saat 09:00'daki programımı düzenle."<br><br>
              Size nasıl yardımcı olabilirim?
            </div>
          </div>
          <div class="ai-chat-input-area">
            <input type="text" id="ai-chat-input" placeholder="Bir şeyler yaz..." autocomplete="off"/>
            <button id="ai-chat-send">➤</button>
          </div>
        </div>
        <!-- Chat Button -->
        <button id="ai-chat-btn" class="ai-chat-btn" title="AI Asistan">
          ✨
        </button>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHtml);

    const btn = document.getElementById('ai-chat-btn');
    const windowEl = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('ai-chat-close');
    const sendBtn = document.getElementById('ai-chat-send');
    const inputEl = document.getElementById('ai-chat-input');
    const messagesEl = document.getElementById('ai-chat-messages');

    // Toggle window
    btn.addEventListener('click', () => {
        windowEl.classList.toggle('hidden');
        if (!windowEl.classList.contains('hidden')) {
            inputEl.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        windowEl.classList.add('hidden');
    });

    const addMessage = (text, sender = 'user') => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.textContent = text;
        messagesEl.appendChild(msgDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const handleSend = async () => {
        const text = inputEl.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        inputEl.value = '';

        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message loading';
        loadingDiv.textContent = 'Yanıt oluşturuluyor...';
        messagesEl.appendChild(loadingDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        try {
            const state = store.state;
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, state })
            });

            const data = await response.json();
            loadingDiv.remove();

            if (data.error) {
                addMessage(data.error, 'error');
            } else {
                if (data.message) {
                    addMessage(data.message, 'ai');
                }
                if (data.actions && Array.isArray(data.actions)) {
                    data.actions.forEach(action => {
                        try {
                            if (action.type === 'addTask') {
                                store.addTask(action.payload);
                            } else if (action.type === 'addHabit') {
                                store.addHabit(action.payload);
                            } else if (action.type === 'deleteTask') {
                                if (action.payload && action.payload.id) {
                                    store.deleteTask(action.payload.id);
                                }
                            } else if (action.type === 'updateTask') {
                                if (action.payload && action.payload.id && action.payload.updates) {
                                    store.updateTask(action.payload.id, action.payload.updates);
                                }
                            } else if (action.type === 'updateSchedule') {
                                if (action.payload && action.payload.id && action.payload.updates) {
                                    store.updateScheduleEntry(action.payload.id, action.payload.updates);
                                }
                            } else if (action.type === 'clearCompleted') {
                                store.clearCompleted(action.payload.list || 'daily');
                            } else if (action.type === 'addCategory') {
                                store.addCategory(action.payload.label, action.payload.icon || '📌', action.payload.color || '#64748b');
                            } else if (action.type === 'deleteCategory') {
                                store.deleteCategory(action.payload.id);
                            } else if (action.type === 'setTheme') {
                                store.setTheme(action.payload.theme);
                            } else if (action.type === 'clearWeeklySchedule') {
                                store.clearWeeklySchedule();
                            }
                        } catch (e) {
                            console.error("Action error:", e);
                        }
                    });
                }
            }
        } catch (err) {
            loadingDiv.remove();
            addMessage('Sistemsel bir hata oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyiniz.', 'error');
        }
    };

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}
