import random
from datetime import datetime, timedelta


def ilerleme_yuzdesi(gorevler):
    total = len(gorevler)
    done = sum(g["durum"] for g in gorevler)
    return (done / total * 100) if total > 0 else 0


def zaman_formatla(saniye):
    dakika, sn = divmod(saniye, 60)
    return f"{dakika:02d}:{sn:02d}"


def oncelik_rengi_getir(oncelik):
    renkler = {"Kolay": "#4ade80", "Orta": "#facc15", "Zor": "#f87171"}
    return renkler.get(oncelik, "#94a3b8")


def kategori_istatistik_hesapla(gorevler):
    istatistik = {}
    kategoriler = ["Yazılım", "Spor", "Üniversite", "Genel"]
    for kat in kategoriler:
        kat_gorevleri = [g for g in gorevler if g.get("kategori") == kat]
        toplam = len(kat_gorevleri)
        tamamlanan = sum(1 for g in kat_gorevleri if g.get("durum") == 1)
        yuzde = (tamamlanan / toplam * 100) if toplam > 0 else 0
        istatistik[kat] = yuzde
    return istatistik


def motivasyon_sozu_getir():
    sozler = ["Sadece başla, gerisi gelecek.", "Odaklan, çalış ve başar!", "Küçük adımlar, büyük sonuçlar doğurur."]
    return random.choice(sozler)


def tum_rozetleri_getir():
    return [
        {"gun": 3, "isim": "Bronz", "simge": "🥉"},
        {"gun": 7, "isim": "Gümüş", "simge": "🥈"},
        {"gun": 15, "isim": "Altın", "simge": "🥇"},
        {"gun": 30, "isim": "Elmas", "simge": "💎"},
        {"gun": 100, "isim": "Focus", "simge": "👑"}
    ]


def rozet_kontrol(seri_sayisi):
    rozetler = {3: "🥉 Bronz (3 Gün)", 7: "🥈 Gümüş (7 Gün)", 15: "🥇 Altın (15 Gün)", 30: "💎 Elmas (30 Gün)",
                100: "👑 Full Focus (100 Gün)"}
    kazanilan = None
    for baraj, isim in sorted(rozetler.items(), reverse=True):
        if seri_sayisi >= baraj:
            kazanilan = isim
            break
    return kazanilan


def seri_hesapla(veriler):
    bugun = datetime.now().strftime("%Y-%m-%d")
    dun = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    seri = veriler.get("seri", 0)
    son_tarih = veriler.get("son_tarih", "")
    rozet_tarihleri = veriler.get("rozet_tarihleri", {})

    gunluk_liste = veriler.get("gunluk", [])
    tamamlandi_mi = len(gunluk_liste) > 0 and all(g["durum"] == 1 for g in gunluk_liste)

    if son_tarih == bugun: return seri, son_tarih, rozet_tarihleri

    if tamamlandi_mi:
        if son_tarih == dun:
            seri += 1
        else:
            seri = 1
        son_tarih = bugun
        for r in tum_rozetleri_getir():
            if seri >= r["gun"] and str(r["gun"]) not in rozet_tarihleri:
                rozet_tarihleri[str(r["gun"])] = datetime.now().strftime("%d.%m.%Y")
    else:
        if son_tarih != dun and son_tarih != bugun and son_tarih != "": seri = 0
    return seri, son_tarih, rozet_tarihleri


def kontrast_rengi_getir(hex_color):
    try:
        hex_color = hex_color.lstrip('#')
        rgb = tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
        parlaklik = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
        return "#000000" if parlaklik > 128 else "#ffffff"
    except:
        return "#ffffff"