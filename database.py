import json
import os
import sys

def get_data_dir():
    if getattr(sys, 'frozen', False):
        # If compiled as an app (.app or .exe), save data to a persistent folder
        home = os.path.expanduser("~")
        data_dir = os.path.join(home, ".FocusFlowPro")
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)
        return data_dir
    else:
        # If run from command line/PyCharm, save to the current project folder
        return os.path.dirname(os.path.abspath(__file__))

def verileri_yukle(dosya_adi):
    # Get the safest, persistent path
    data_dir = get_data_dir()
    dosya_yolu = os.path.join(data_dir, dosya_adi)
    
    varsayilan = {"gunluk": [], "haftalik": [], "seri": 0, "son_tarih": "", "rozet_tarihleri": {}}
    if os.path.exists(dosya_yolu):
        try:
            with open(dosya_yolu, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return varsayilan
    return varsayilan

def verileri_kaydet(dosya_adi, veriler):
    # Get the safest, persistent path
    data_dir = get_data_dir()
    dosya_yolu = os.path.join(data_dir, dosya_adi)
    
    with open(dosya_yolu, "w", encoding="utf-8") as f:
        json.dump(veriler, f, ensure_ascii=False, indent=4)