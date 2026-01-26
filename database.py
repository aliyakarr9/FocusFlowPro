import json
import os

def verileri_yukle(dosya_adi):
    varsayilan = {"gunluk": [], "haftalik": [], "seri": 0, "son_tarih": "", "rozet_tarihleri": {}}
    if os.path.exists(dosya_adi):
        try:
            with open(dosya_adi, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return varsayilan
    return varsayilan

def verileri_kaydet(dosya_adi, veriler):
    with open(dosya_adi, "w", encoding="utf-8") as f:
        json.dump(veriler, f, ensure_ascii=False, indent=4)