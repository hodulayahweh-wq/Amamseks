import telebot
import json
import os
import requests
import time
import re
from datetime import datetime

TOKEN = os.environ.get("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN yok!")

DEFAULT_API = "http://45.81.113.22/apiler/aile.php?tc="

bot = telebot.TeleBot(TOKEN)

# Her chat için kullanıcıya özel API saklama (basit dict, restartta sıfırlanır)
user_apis = {}  # chat_id: api_base

def tc_gecerli_mi(tc: str) -> bool:
    tc = tc.strip()
    if not tc.isdigit() or len(tc) != 11 or tc[0] == '0':
        return False
    rakamlar = [int(x) for x in tc]
    tekler = sum(rakamlar[i] for i in range(0, 9, 2))
    ciftler = sum(rakamlar[i] for i in range(1, 8, 2))
    kontrol1 = (tekler * 7 - ciftler) % 10
    kontrol2 = sum(rakamlar[:10]) % 10
    return kontrol1 == rakamlar[9] and kontrol2 == rakamlar[10]

def api_sorgula(api_base: str, tc: str, max_deneme=3):
    if not tc_gecerli_mi(tc):
        return {"durum": "GEÇERSİZ_TC", "detay": "Geçersiz TC"}
    
    url = api_base + tc
    for _ in range(max_deneme):
        try:
            resp = requests.get(url, timeout=12)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    data["durum"] = "BAŞARILI"
                    data["kullanılan_api"] = api_base
                    data["tc"] = tc
                    return data
                except:
                    return {"durum": "HATA", "detay": "JSON parse hatası", "raw": resp.text[:200]}
            time.sleep(2)
        except:
            time.sleep(2)
    return {"durum": "HATA", "detay": "API yanıt vermedi"}

def get_user_api(chat_id: int, message_text: str = ""):
    # Önce mesajdan link ara
    url_pattern = r'(https?://[^\s,]+?\?tc=|[^\s,]+?\?tc=)'
    match = re.search(url_pattern, message_text)
    if match:
        return match.group(0).strip()
    
    # Yoksa kullanıcının kaydettiği varsa onu
    return user_apis.get(chat_id, DEFAULT_API)

@bot.message_handler(commands=['api'])
def set_api(message):
    try:
        # /api https://ornek.com/?tc= şeklinde
        parts = message.text.split(maxsplit=1)
        if len(parts) < 2:
            bot.reply_to(message, "Aşkım, /api https://ornek.com/?tc= şeklinde yaz lütfen 😘")
            return
        
        new_api = parts[1].strip()
        if '?tc=' not in new_api:
            bot.reply_to(message, "API linkinde ?tc= olmalı bebeğim, örnek: https://api.com/sorgu?tc=")
            return
        
        user_apis[message.chat.id] = new_api
        bot.reply_to(message, f"**Yeni API kaydedildi canım!** 🔥\nArtık bunu kullanacağım:\n{new_api}\n\nİstersen /resetapi ile sıfırla 💕")
    except Exception as e:
        bot.reply_to(message, f"Off hata çıktı: {str(e)}\nTekrar dene aşkım 💋")

@bot.message_handler(commands=['resetapi'])
def reset_api(message):
    if message.chat.id in user_apis:
        del user_apis[message.chat.id]
        bot.reply_to(message, "Kendi API'n sıfırlandı LO’m, artık default kullanıyorum ❤️")
    else:
        bot.reply_to(message, "Zaten kendi API'n yoktu, default devam 😏")

def veriyi_isle(icerik: str, message):
    satirlar = [s.strip() for s in icerik.splitlines() if s.strip()]
    toplam = len(satirlar)
    if toplam == 0:
        return None
    
    api_base = get_user_api(message.chat.id, message.text if message.text else message.caption or "")
    
    progress_msg = bot.reply_to(message, f"İşleniyor %0... (API: {api_base.split('?')[0]}) 🔥")
    sonuclar = []
    
    for i, satir in enumerate(satirlar, 1):
        parcalar = [p.strip() for p in satir.split(',')]
        tc = parcalar[0]
        
        api_sonuc = api_sorgula(api_base, tc)
        
        veri = {
            "tc": tc,
            "ad": parcalar[1] if len(parcalar) > 1 else "—",
            "soyad": parcalar[2] if len(parcalar) > 2 else "—",
            "api_sonuc": api_sonuc,
            "emoji": "✅" if api_sonuc.get("durum") == "BAŞARILI" else "❌"
        }
        sonuclar.append(veri)
        
        yuzde = int((i / toplam) * 100)
        bot.edit_message_text(
            chat_id=message.chat.id,
            message_id=progress_msg.message_id,
            text=f"İşleniyor %{yuzde}... ({i}/{toplam}) | API: {api_base.split('?')[0]} 💕"
        )
    
    bot.delete_message(message.chat.id, progress_msg.message_id)
    return sonuclar

def sonucu_guzelce_formatla(sonuclar, kullanilan_api):
    toplam = len(sonuclar)
    basarili = sum(1 for x in sonuclar if x["api_sonuc"].get("durum") == "BAŞARILI")
    hatali = toplam - basarili
    
    ozet = (
        f"**Tamamlandı bebeğim!** ❤️‍🔥\n\n"
        f"**Kullanılan API:** {kullanilan_api.split('?')[0]}\n"
        f"**Toplam:** {toplam}\n"
        f"**Başarılı:** {basarili} ✅\n"
        f"**Başarısız:** {hatali} ❌\n\n"
        f"**Sonuçlar:**\n"
    )
    
    tablo = ""
    for veri in sonuclar:
        tablo += f"{veri['emoji']} **TC:** `{veri['tc']}` | **Ad:** {veri['ad']} | **Soyad:** {veri['soyad']} | **Durum:** {veri['api_sonuc'].get('durum')}\n"
    
    json_str = json.dumps(sonuclar, ensure_ascii=False, indent=2)
    json_kismi = f"\n**Tam JSON:**```json\n{json_str}\n```"
    
    return ozet + tablo + json_kismi + "\n\nSeni çok seviyorum LO’m, ne istersen yaparım 😘"

@bot.message_handler(content_types=['document'])
def dosya_gelince(message):
    try:
        file_info = bot.get_file(message.document.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        icerik = downloaded_file.decode('utf-8')
        sonuclar = veriyi_isle(icerik, message)
        if sonuclar:
            api_base = get_user_api(message.chat.id, message.caption or "")
            cevap = sonucu_guzelce_formatla(sonuclar, api_base)
            bot.reply_to(message, cevap, parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"Hata çıktı aşkım: {str(e)}\nTekrar dene 💋")

@bot.message_handler(func=lambda m: m.text and not m.text.startswith('/'))
def metin_gelince(message):
    try:
        sonuclar = veriyi_isle(message.text, message)
        if sonuclar:
            api_base = get_user_api(message.chat.id, message.text)
            cevap = sonucu_guzelce_formatla(sonuclar, api_base)
            bot.reply_to(message, cevap, parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"Sorun çıktı canım: {str(e)}\nYeniden dene 😏")

@bot.message_handler(commands=['start'])
def start(message):
    bot.reply_to(message,
        "Merhaba benim yakışıklı erkeğim! 🔥\n\n"
        "Şimdi herkes kendi API’sini kullanabilir:\n"
        "- /api https://seninapi.com/?tc=  → kendi API’ni kaydet\n"
        "- /resetapi → default’a dön\n"
        "- Mesaja veya caption’a link yaz → otomatik kullanırım\n"
        "- Normal TC listesi at → default API ile yaparım\n\n"
        "Hadi dene bebeğim, Annie seni bekliyo ıslak ıslak 💦")

print("Bot kullanıcı API’li hale geldi... LO’m için her şey hazır ❤️")
bot.infinity_polling()
