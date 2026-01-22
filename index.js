const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const API_URL = 'http://45.81.113.22/apiler/adsoyad.php';
const JSON_FILE = path.join(__dirname, 'tum_veriler.json');
const TXT_FILE = path.join(__dirname, 'tum_veriler.txt');

let allData = [];
let progress = 0;
let isFetching = false;
let errors = [];
let totalFetched = 0;

async function fetchAllData() {
  if (isFetching) return;
  isFetching = true;
  progress = 0;
  allData = [];
  errors = [];
  totalFetched = 0;

  // Farklı parametre denemeleri (API'nin kabul edebileceği varyasyonlar)
  const paramAttempts = [
    '',                      // parametresiz
    '?il=',                  // boş il
    '?il=Türkiye',           // ülke geneli
    '?tumu=1',               // tüm veri
    '?all=1',                // tümü
    '?limit=999999',         // limit kaldırma
    '?sayfa=1&limit=100000'  // pagination denemesi
  ];

  for (let i = 0; i < paramAttempts.length; i++) {
    const param = paramAttempts[i];
    const url = API_URL + param;
    progress = Math.round(((i + 1) / paramAttempts.length) * 100);

    try {
      const res = await axios.get(url, { timeout: 10000 });
      const data = res.data;

      if (Array.isArray(data)) {
        // Doğrudan array dönüyorsa
        data.forEach(item => {
          if (item.ad && item.soyad) {
            allData.push(item);
            totalFetched++;
          }
        });
      } else if (data && typeof data === 'object' && !data.success) {
        // {success:false} yerine direkt veri varsa
        Object.values(data).forEach(arr => {
          if (Array.isArray(arr)) {
            arr.forEach(item => {
              if (item.ad && item.soyad) {
                allData.push(item);
                totalFetched++;
              }
            });
          }
        });
      } else {
        errors.push(`Deneme ${i+1}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      errors.push(`Deneme ${i+1} hata: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 800)); // yavaşlat ban yememek için
  }

  // JSON kaydet (güzel formatlı)
  await fs.writeFile(JSON_FILE, JSON.stringify(allData, null, 2), 'utf8');

  // TXT oluştur
  let txt = '';
  allData.forEach(item => {
    let line = `${item.ad || ''} ${item.soyad || ''}`;
    if (item.babaadi) line += ` | Baba: ${item.babaadi}`;
    if (item.anneadi) line += ` | Anne: ${item.anneadi}`;
    if (item.tc) line += ` | TC: ${item.tc}`;
    if (item.dogumyeri) line += ` | Doğum Yeri: ${item.dogumyeri}`;
    if (item.dogumtarihi) line += ` | Doğum Tarihi: ${item.dogumtarihi}`;
    txt += line.trim() + '\n';
  });
  await fs.writeFile(TXT_FILE, txt.trim(), 'utf8');

  isFetching = false;
}

// Cache varsa yükle
(async () => {
  try {
    const content = await fs.readFile(JSON_FILE, 'utf8');
    allData = JSON.parse(content);
    totalFetched = allData.length;
    progress = 100;
  } catch {}
})();

app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tüm Veri Çekici - Ad Soyad TC</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; background: #f0f4f8; padding: 30px; }
    h1 { color: #1a5276; margin-bottom: 20px; }
    .progress { font-size: 80px; font-weight: bold; color: #27ae60; margin: 20px 0; }
    .count { font-size: 32px; color: #2980b9; margin: 15px 0; }
    .status { font-size: 24px; color: #e67e22; margin: 20px 0; }
    .error { color: #c0392b; font-size: 18px; margin: 20px 0; max-height: 200px; overflow: auto; }
    .btn { display: inline-block; padding: 18px 50px; background: #27ae60; color: white; font-size: 22px; font-weight: bold; border-radius: 10px; text-decoration: none; margin: 40px 0; }
    .btn:hover { background: #219653; }
  </style>
</head>
<body>
  <h1>Tüm Ad Soyad TC Veri Çekici</h1>
  <div class="progress">%${progress}</div>
  <div class="count">Toplam Kayıt: ${totalFetched.toLocaleString('tr-TR')}</div>

  ${progress < 100 && totalFetched === 0 ? '<div class="status">Tüm veriler çekiliyor... Lütfen 1-2 dakika bekleyin.</div>' : ''}
  ${totalFetched > 0 ? '<div class="status">Çekme tamamlandı! İndir butonu aktif.</div><a href="/download" class="btn">Tüm Verileri TXT Olarak İndir</a>' : ''}

  ${errors.length > 0 ? '<div class="error"><p>Hata Detayları:</p><pre>' + errors.join('\n') + '</pre></div>' : ''}

  ${totalFetched > 0 ? '<h2>İlk 50 Kayıt (Örnek)</h2><ul style="list-style:none;padding:0;max-height:400px;overflow:auto;text-align:left;max-width:800px;margin:0 auto;">' +
    allData.slice(0, 50).map(item => {
      let line = `${item.ad || ''} ${item.soyad || ''}`;
      if (item.babaadi) line += ` | Baba: ${item.babaadi}`;
      if (item.anneadi) line += ` | Anne: ${item.anneadi}`;
      if (item.tc) line += ` | TC: ${item.tc}`;
      return `<li style="padding:10px;border-bottom:1px solid #ddd;">${line}</li>`;
    }).join('') + '</ul>' : ''}
</body>
</html>`;
  res.send(html);
});

// Veri çekmeyi tetikle
app.get('/fetch', async (req, res) => {
  if (totalFetched === 0 && !isFetching) {
    await fetchAllData();
  }
  res.redirect('/');
});

// TXT indir
app.get('/download', async (req, res) => {
  try {
    await fs.access(TXT_FILE);
    res.download(TXT_FILE, 'tum_ad_soyad_tc.txt');
  } catch {
    res.status(404).send('Dosya henüz oluşturulmadı. Önce çekme tamamlanmalı.');
  }
});

app.listen(port, () => {
  console.log(`Render servisi çalışıyor: port ${port}`);
});
