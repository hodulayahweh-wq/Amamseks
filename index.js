// ... (önceki kodun üst kısmı aynı kalıyor, sadece fetchAllData fonksiyonunu değiştir)

async function fetchAllData() {
  if (isFetching) return;
  isFetching = true;
  progress = 0;
  allData = [];
  errors = [];
  totalFetched = 0;

  // Daha fazla parametre denemesi + log için
  const paramAttempts = [
    '', 
    '?il=', 
    '?il=Türkiye', 
    '?il=*', 
    '?tumu=1', 
    '?all=1', 
    '?getall=1', 
    '?list=all', 
    '?limit=100000', 
    '?sayfa=1&adet=999999', 
    '?format=json&all=true'
  ];

  for (let i = 0; i < paramAttempts.length; i++) {
    const param = paramAttempts[i];
    const url = API_URL + param;
    progress = Math.round(((i + 1) / paramAttempts.length) * 100);

    try {
      const res = await axios.get(url, { timeout: 15000 });
      console.log(`Deneme \( {i+1} ( \){param}): HTTP ${res.status} - Yanıt uzunluğu: ${res.data.toString().length}`);

      const data = res.data;

      if (Array.isArray(data)) {
        console.log(`Array geldi, kayıt: ${data.length}`);
        data.forEach(item => {
          if (item.ad && item.soyad) {
            allData.push(item);
            totalFetched++;
          }
        });
      } else if (data && typeof data === 'object') {
        console.log(`Object geldi, success: ${data.success}`);
        if (!data.success && data.message) {
          errors.push(`Deneme ${i+1}: ${data.message}`);
        } else if (data.data || data.result) {
          // Bazı API'ler data veya result altında array döner
          const arr = data.data || data.result || [];
          if (Array.isArray(arr)) {
            arr.forEach(item => {
              if (item.ad && item.soyad) {
                allData.push(item);
                totalFetched++;
              }
            });
          }
        }
      } else {
        errors.push(`Deneme ${i+1}: Beklenmeyen format`);
      }
    } catch (err) {
      console.log(`Deneme ${i+1} hata: ${err.message}`);
      errors.push(`Deneme ${i+1}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 1000)); // 1 sn bekle, ban yememek için
  }

  // ... (JSON ve TXT kaydetme kısmı aynı kalıyor)
}
