import tkinter as tk
from tkinter import ttk, messagebox
import database
import logic
import time


class AsistanPro:
    def __init__(self, root):
        self.root = root
        self.root.title("FocusFlow Pro")
        self.root.geometry("550x850")

        self.colors = {
            "bg": "#1e1e2e", "card": "#2b2b3b", "accent": "#ff79c6", "text": "#f8f8f2",
            "Yazılım": "#8be9fd", "Spor": "#ffb86c", "Üniversite": "#bd93f9", "Genel": "#6272a4",
            "Kolay": "#4ade80", "Orta": "#fbbf24", "Zor": "#f87171"
        }

        self.dosya_adi = "asistan_verileri.json"
        self.veriler = database.verileri_yukle(self.dosya_adi)
        self.seri_sayisi = self.veriler.get("seri", 0)

        self.pomo_sure_saniye = 25 * 60
        self.pomo_calisiyor = False
        self.pomo_id = None
        self.mini_mod_aktif = False

        self.style_ayarla()
        self.arayuz_olustur()

    def style_ayarla(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TNotebook", background=self.colors["bg"], borderwidth=0)
        style.configure("TNotebook.Tab", background=self.colors["card"], foreground=self.colors["text"],
                        padding=[12, 8], font=("Segoe UI", 9, "bold"))
        style.map("TNotebook.Tab", background=[("selected", self.colors["accent"])],
                  foreground=[("selected", "#000000")])

    def arayuz_olustur(self):
        # Üst Panel
        self.seri_frame = tk.Frame(self.root, bg=self.colors["bg"])
        self.seri_frame.pack(fill="x", padx=20, pady=(10, 0))
        self.seri_label = tk.Label(self.seri_frame, text=f"🔥 {self.seri_sayisi} GÜNLÜK SERİ",
                                   font=("Segoe UI", 11, "bold"), bg=self.colors["bg"], fg=self.colors["Spor"])
        self.seri_label.pack(side="right")
        self.rozet_label = tk.Label(self.seri_frame, text=logic.rozet_kontrol(self.seri_sayisi) or "🌱 Çaylak",
                                    font=("Segoe UI", 9, "italic"), bg=self.colors["bg"], fg=self.colors["accent"])
        self.rozet_label.pack(side="left")

        # Sekmeler
        self.tabs = ttk.Notebook(self.root)
        self.tab_gunluk = tk.Frame(self.tabs, bg=self.colors["bg"])
        self.tab_haftalik = tk.Frame(self.tabs, bg=self.colors["bg"])
        self.tab_pomo = tk.Frame(self.tabs, bg=self.colors["bg"])
        self.tab_analiz = tk.Frame(self.tabs, bg=self.colors["bg"])
        self.tab_koleksiyon = tk.Frame(self.tabs, bg=self.colors["bg"])

        self.tabs.add(self.tab_gunluk, text=" GÜNLÜK ")
        self.tabs.add(self.tab_haftalik, text=" HAFTALIK ")
        self.tabs.add(self.tab_pomo, text=" POMO ")
        self.tabs.add(self.tab_analiz, text=" ANALİZ ")
        self.tabs.add(self.tab_koleksiyon, text=" KOLEKSİYON ")
        self.tabs.pack(expand=1, fill="both", padx=10, pady=10)

        # Motivasyon Paneli
        self.motivasyon_frame = tk.Frame(self.root, bg=self.colors["card"])
        self.motivasyon_frame.pack(fill="x", side="bottom", padx=20, pady=(0, 20))
        self.motivasyon_label = tk.Label(self.motivasyon_frame, text=logic.motivasyon_sozu_getir(),
                                         font=("Segoe UI", 10, "italic"), bg=self.colors["card"],
                                         fg=self.colors["accent"], wraplength=450, pady=10)
        self.motivasyon_label.pack()

        self.sayfa_tasarla(self.tab_gunluk, "gunluk")
        self.sayfa_tasarla(self.tab_haftalik, "haftalik")
        self.pomo_sayfasi_tasarla()
        self.analiz_sayfasi_tasarla()
        self.koleksiyon_sayfasi_tasarla()

    def sayfa_tasarla(self, frame, tip):
        header = tk.Frame(frame, bg=self.colors["bg"]);
        header.pack(fill="x", pady=10)
        y_val = tk.Label(header, text="%0", font=("Helvetica", 35, "bold"), bg=self.colors["bg"],
                         fg=self.colors["accent"]);
        y_val.pack()
        setattr(self, f"{tip}_label", y_val)

        input_c = tk.Frame(frame, bg=self.colors["card"], padx=10, pady=10);
        input_c.pack(fill="x", padx=15, pady=10)
        ent = tk.Entry(input_c, bg=self.colors["bg"], fg="white", relief="flat", font=("Segoe UI", 11),
                       insertbackground="white");
        ent.pack(fill="x", pady=5)

        ctrl = tk.Frame(input_c, bg=self.colors["card"]);
        ctrl.pack(fill="x")
        k_var = tk.StringVar(value="Genel")
        ttk.Combobox(ctrl, textvariable=k_var, values=("Yazılım", "Spor", "Üniversite", "Genel"), state="readonly",
                     width=10).pack(side="left", padx=2)
        o_var = tk.StringVar(value="Orta")
        ttk.Combobox(ctrl, textvariable=o_var, values=("Kolay", "Orta", "Zor"), state="readonly", width=8).pack(
            side="left", padx=2)
        tk.Button(ctrl, text=" EKLE ", bg=self.colors["accent"], fg="black", font=("Segoe UI", 9, "bold"),
                  relief="raised", command=lambda: self.gorev_ekle(ent, k_var, o_var, tip)).pack(side="right", padx=5)

        container = tk.Frame(frame, bg=self.colors["bg"]);
        container.pack(expand=True, fill="both", padx=5, pady=5)
        canvas = tk.Canvas(container, bg=self.colors["bg"], highlightthickness=0);
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=self.colors["bg"])
        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set);
        canvas.pack(side="left", expand=True, fill="both");
        scrollbar.pack(side="right", fill="y")
        setattr(self, f"{tip}_frame", scrollable_frame)
        self.liste_yenile(tip)

    def liste_yenile(self, tip):
        frame = getattr(self, f"{tip}_frame");
        [w.destroy() for w in frame.winfo_children()]
        for i, obj in enumerate(self.veriler[tip]):
            kat = obj.get("kategori", "Genel");
            onem = obj.get("onem", "Orta");
            o_renk = logic.oncelik_rengi_getir(onem)
            card = tk.Frame(frame, bg=self.colors["card"], pady=8, padx=10);
            card.pack(fill="x", pady=3, padx=10)
            tk.Frame(card, bg=self.colors.get(kat, self.colors["Genel"]), width=4).pack(side="left", fill="y",
                                                                                        padx=(0, 10))

            tk.Button(card, text="✕", bg=self.colors["card"], fg="#ff5555", relief="flat", font=("Arial", 10, "bold"),
                      command=lambda i=i, t=tip: self.gorev_sil(i, t)).pack(side="right", padx=(5, 0))
            if tip == "haftalik":
                tk.Button(card, text="📅+", bg=self.colors["card"], fg=self.colors["accent"], relief="flat",
                          font=("Arial", 9, "bold"), command=lambda idx=i: self.haftaligi_gunluge_aktar(idx)).pack(
                    side="right", padx=5)
            tk.Label(card, text=onem, font=("Arial", 7, "bold"), bg=o_renk, fg="black", padx=5, pady=2).pack(
                side="right", padx=5)

            v = tk.IntVar(value=obj["durum"])
            cb = tk.Checkbutton(card, text=obj["gorev"], variable=v, bg=self.colors["card"], fg="white",
                                selectcolor=self.colors["bg"], font=("Segoe UI", 10), wraplength=280, justify="left",
                                command=lambda i=i, var=v, t=tip: self.durum_degistir(i, var, t))
            cb.pack(side="left", fill="x", expand=True)
        self.ilerleme_hesapla(tip)

    def pomo_sayfasi_tasarla(self):
        for w in self.tab_pomo.winfo_children(): w.destroy()
        tk.Label(self.tab_pomo, text="Odaklanma Zamanlayıcısı", font=("Segoe UI", 20, "bold"), bg=self.colors["bg"],
                 fg="white").pack(pady=30)
        self.pomo_label = tk.Label(self.tab_pomo, text=logic.zaman_formatla(self.pomo_sure_saniye),
                                   font=("Helvetica", 65, "bold"), bg=self.colors["bg"], fg=self.colors["accent"])
        self.pomo_label.pack(pady=20)

        ayar_f = tk.Frame(self.tab_pomo, bg=self.colors["bg"]);
        ayar_f.pack(pady=10)
        self.pomo_entry = tk.Entry(ayar_f, width=5, font=("Arial", 14), justify="center", bg=self.colors["card"],
                                   fg="white", insertbackground="white", relief="flat")
        self.pomo_entry.insert(0, str(int(self.pomo_sure_saniye / 60)));
        self.pomo_entry.pack()

        btn_f = tk.Frame(self.tab_pomo, bg=self.colors["bg"]);
        btn_f.pack(pady=10)
        self.btn_pomo_start = tk.Button(btn_f, text=" BAŞLAT " if not self.pomo_calisiyor else " DURDUR ",
                                        bg=self.colors["accent"], fg="black", font=("Arial", 12, "bold"),
                                        relief="raised", padx=20, pady=10, command=self.pomo_toggle)
        self.btn_pomo_start.pack(side="left", padx=10)
        tk.Button(btn_f, text=" SIFIRLA ", bg=self.colors["Genel"], fg="white", font=("Arial", 10), relief="flat",
                  padx=15, pady=10, command=self.pomo_sifirla).pack(side="left", padx=10)
        tk.Button(self.tab_pomo, text="📺 MİNİ MOD", bg=self.colors["card"], fg="white", font=("Arial", 9),
                  relief="flat", command=self.mini_mod_gecis).pack(pady=20)

    def mini_mod_gecis(self):
        if not self.mini_mod_aktif:
            self.mini_mod_aktif = True
            self.tabs.pack_forget();
            self.seri_frame.pack_forget();
            self.motivasyon_frame.pack_forget();
            self.pomo_label.destroy()
            self.root.overrideredirect(False);
            self.root.attributes("-topmost", True);
            self.root.attributes("-type", "utility")
            screen_w = self.root.winfo_screenwidth()
            self.root.geometry(f"160x100+{screen_w - 180}+50");
            self.root.configure(bg=self.colors["card"])
            self.pomo_label = tk.Label(self.root, text=logic.zaman_formatla(self.pomo_sure_saniye),
                                       font=("Helvetica", 35, "bold"), bg=self.colors["card"], fg=self.colors["accent"])
            self.pomo_label.pack(expand=True, fill="both")
            self.mini_bilgi = tk.Label(self.root, text="Büyütmek için Çift Tık", font=("Arial", 8),
                                       bg=self.colors["card"], fg="white");
            self.mini_bilgi.pack(side="bottom", pady=2)
            self.root.bind("<Double-Button-1>", lambda e: self.mini_mod_gecis());
            self.pomo_label.bind("<Double-Button-1>", lambda e: self.mini_mod_gecis());
            self.root.update()
        else:
            self.mini_mod_aktif = False
            self.pomo_label.destroy()
            if hasattr(self, 'mini_bilgi'): self.mini_bilgi.destroy()
            self.root.attributes("-type", "normal")
            self.root.geometry(
                f"550x850+{(self.root.winfo_screenwidth() - 550) // 2}+{(self.root.winfo_screenheight() - 850) // 2}")
            self.root.configure(bg=self.colors["bg"]);
            self.root.unbind("<Double-Button-1>")
            self.arayuz_olustur()

    def pomo_toggle(self):
        if not self.pomo_calisiyor:
            try:
                d = int(self.pomo_entry.get())
            except:
                return
            if not self.pomo_id: self.pomo_sure_saniye = d * 60
            self.pomo_calisiyor = True;
            self.btn_pomo_start.config(text=" DURDUR ", bg="#ffb86c");
            self.pomo_say()
        else:
            self.pomo_calisiyor = False;
            self.btn_pomo_start.config(text=" BAŞLAT ", bg=self.colors["accent"])
            if self.pomo_id: self.root.after_cancel(self.pomo_id)

    def pomo_say(self):
        if self.pomo_sure_saniye > 0 and self.pomo_calisiyor:
            self.pomo_label.config(text=logic.zaman_formatla(self.pomo_sure_saniye))
            self.pomo_sure_saniye -= 1;
            self.pomo_id = self.root.after(1000, self.pomo_say)
        elif self.pomo_sure_saniye <= 0:
            self.pomo_calisiyor = False;
            messagebox.showinfo("FocusFlow", "Süre doldu! 🏆");
            self.pomo_sifirla()

    def pomo_sifirla(self):
        if self.pomo_id: self.root.after_cancel(self.pomo_id)
        self.pomo_id = None;
        self.pomo_calisiyor = False
        try:
            d = int(self.pomo_entry.get()); self.pomo_sure_saniye = d * 60
        except:
            self.pomo_sure_saniye = 25 * 60
        self.pomo_label.config(text=logic.zaman_formatla(self.pomo_sure_saniye))
        self.btn_pomo_start.config(text=" BAŞLAT ", bg=self.colors["accent"])

    def gorev_ekle(self, entry, kat, onem, tip):
        if entry.get():
            self.veriler[tip].append(
                {"id": str(time.time()), "gorev": entry.get(), "durum": 0, "kategori": kat.get(), "onem": onem.get()})
            entry.delete(0, tk.END);
            database.verileri_kaydet(self.dosya_adi, self.veriler);
            self.liste_yenile(tip);
            self.grafik_guncelle()

    def gorev_sil(self, index, tip):
        del self.veriler[tip][index];
        database.verileri_kaydet(self.dosya_adi, self.veriler);
        self.liste_yenile(tip);
        self.grafik_guncelle()

    def haftaligi_gunluge_aktar(self, index):
        h_gorev = self.veriler["haftalik"][index]
        if any(g.get("id") == h_gorev.get("id") for g in self.veriler["gunluk"]):
            messagebox.showwarning("Uyarı", "Bu görev zaten günlük listende!")
            return
        yeni_g = h_gorev.copy();
        yeni_g["gorev"] = f"🔗 {h_gorev['gorev']}"
        self.veriler["gunluk"].append(yeni_g);
        database.verileri_kaydet(self.dosya_adi, self.veriler);
        self.liste_yenile("gunluk")

    def durum_degistir(self, index, var, tip):
        obj = self.veriler[tip][index];
        yeni_durum = var.get();
        obj["durum"] = yeni_durum
        if tip == "gunluk" and obj.get("id"):
            for h_obj in self.veriler["haftalik"]:
                if h_obj.get("id") == obj.get("id"): h_obj["durum"] = yeni_durum; break
        database.verileri_kaydet(self.dosya_adi, self.veriler);
        self.liste_yenile("gunluk");
        self.liste_yenile("haftalik");
        self.grafik_guncelle()

    def ilerleme_hesapla(self, tip):
        y = logic.ilerleme_yuzdesi(self.veriler[tip]);
        getattr(self, f"{tip}_label").config(text=f"%{int(y)}")

    def analiz_sayfasi_tasarla(self):
        self.analiz_frame = tk.Frame(self.tab_analiz, bg=self.colors["bg"]);
        self.analiz_frame.pack(fill="both", expand=True, padx=30);
        self.grafik_guncelle()

    def grafik_guncelle(self):
        for w in self.analiz_frame.winfo_children(): w.destroy()
        stats = logic.kategori_istatistik_hesapla(self.veriler["gunluk"] + self.veriler["haftalik"])
        for kat, yuzde in stats.items():
            renk = self.colors.get(kat, self.colors["Genel"]);
            f = tk.Frame(self.analiz_frame, bg=self.colors["bg"]);
            f.pack(fill="x", pady=12)
            tk.Label(f, text=f"{kat} (%{int(yuzde)})", bg=self.colors["bg"], fg="white",
                     font=("Arial", 10, "bold")).pack(anchor="w")
            c = tk.Canvas(f, width=350, height=15, bg=self.colors["card"], highlightthickness=0);
            c.pack(anchor="w", pady=2)
            if yuzde > 0: c.create_rectangle(0, 0, yuzde * 3.5, 15, fill=renk, outline="")

    def koleksiyon_sayfasi_tasarla(self):
        self.koleksiyon_list_frame = tk.Frame(self.tab_koleksiyon, bg=self.colors["bg"]);
        self.koleksiyon_list_frame.pack(fill="both", expand=True, padx=20);
        self.koleksiyon_yenile()

    def koleksiyon_yenile(self):
        for w in self.koleksiyon_list_frame.winfo_children(): w.destroy()
        for r in logic.tum_rozetleri_getir():
            kazanildi = self.seri_sayisi >= r["gun"]
            card = tk.Frame(self.koleksiyon_list_frame, bg=self.colors["card"] if kazanildi else "#1a1a25", pady=10,
                            padx=15);
            card.pack(fill="x", pady=5)
            tk.Label(card, text=f"{r['simge']} {r['isim']}", bg=card["bg"], fg="white" if kazanildi else "gray").pack(
                side="left")


if __name__ == "__main__":
    root = tk.Tk();
    app = AsistanPro(root);
    root.mainloop()