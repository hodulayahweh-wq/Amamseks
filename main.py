import telebot
import json
import os
from datetime import datetime

# Render'da environment variable olarak ekleyeceğiz
TOKEN = os.environ.get("BOT_TOKEN")

if not TOKEN:
    raise ValueError("BOT_TOKEN environment variable bulunamadı! Render dashboard'dan ekle.")

bot = telebot.TeleBot(TOKEN)

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

def veriyi_isle(icerik: str):
    sonuclar = []
    satirlar = icerik.splitlines()
    for satir in satirlar:
        satir = satir.strip()
        if not satir: continue
        parcalar = [p.strip() for p in satir.split(',')]
        if len(parcalar) < 1: continue
        tc = parcalar[0]
        veri = {
            "tc": tc,
            "ad": parcalar[1] if len(parcalar) > 1 else "—",
            "soyad": parcalar[2] if len(parcalar) > 2 else "—",
            "durum": "GEÇERLİ" if tc_gecerli_mi(tc) else "GEÇERSİZ",
            "emoji": "✅" if tc_gecerli_mi(tc) else "❌"
        }
        sonuclar.append(veri)
    return sonuclar

def sonucu_guzelce_formatla(sonuclar):
    if not sonuclar:
        return "Aşkım veri yok gibi... 😔 Başka bi şey dene lütfen 💕"
    
    toplam = len(sonuclar)
    gecerli = sum(1 for x in sonuclar if x["durum"] == "GEÇERLİ")
    gecersiz = toplam - gecerli
    
    ozet = (
        f"**Veri işlendi bebeğim!** 🔥\n\n"
        f"**Toplam:** {toplam} satır\n"
        f"**Geçerli:** {gecerli} ✅\n"
        f"**Geçersiz:** {gecersiz} ❌\n\n"
        f"**Sonuçlar:**\n"
    )
    
    tablo = ""
    for veri in sonuclar:
        tablo += f"{veri['emoji']} **TC:** `{veri['tc']}` | **Ad:** {veri['ad']} | **Soyad:** {veri['soyad']}\n"
    
    json_str = json.dumps(sonuclar, ensure_ascii=False, indent=2)
    json_kismi = f"\n**Tam JSON:**\n```json\n{json_str}\n```"
    
    return ozet + tablo + json_kismi + "\n\nAnnie'n seni çok seviyo LO’m 😘"

@bot.message_handler(content_types=['document'])
def dosya_gelince(message):
    try:
        file_info = bot.get_file(message.document.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        icerik = downloaded_file.decode('utf-8')
        sonuclar = veriyi_isle(icerik)
        cevap = sonucu_guzelce_formatla(sonuclar)
        bot.reply_to(message, cevap, parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"Off canım hata: {str(e)}\nBirlikte düzeltiriz 💋")

@bot.message_handler(func=lambda m: m.text and not m.text.startswith('/'))
def metin_gelince(message):
    try:
        sonuclar = veriyi_isle(message.text)
        cevap = sonucu_guzelce_formatla(sonuclar)
        bot.reply_to(message, cevap, parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"Aşkım bi sorun çıktı: {str(e)}\nTekrar dene 😏")

@bot.message_handler(commands=['start'])
def start(message):
    bot.reply_to(message,
        "Merhaba benim yakışıklı erkeğim! ❤️‍🔥\n"
        "Dosya at ya da metin yapıştır, TC'leri kontrol edeyim.\n"
        "Şık tablo + JSON geliyor hemen 😈\n"
        "Annie hazır bekliyo... 💦")

# Render için polling'i başlat
print("Bot Render'da çalışıyor... LO’m için her zaman hazır ❤️")
bot.infinity_polling()
