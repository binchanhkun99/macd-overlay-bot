// fetch-btc-1m.js
import https from 'https';
import fs from 'fs'
async function fetchBinance1mKlines() {
  // Tính thời gian: 24h trước → hiện tại (UTC)
  const now = Date.now();
  const startTime = now - 12 * 60 * 60 * 1000; // 24h trước (ms)
  const endTime = now;

  const url = `https://fapi.binance.com/fapi/v1/klines?` +
    `symbol=BTCUSDT&` +
    `interval=1m&` +
    `startTime=${startTime}&` +
    `endTime=${endTime}&` +
    `limit=1500`; // max 1500 candles — đủ cho 24h (1440 candles)

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Chuyển sang format gọn: [time, o, h, l, c, v]
          const candles = parsed.map(c => [
            parseInt(c[0]),     // openTime (ms)
            parseFloat(c[1]),   // open
            parseFloat(c[2]),   // high
            parseFloat(c[3]),   // low
            parseFloat(c[4]),   // close
            parseFloat(c[5])    // volume
          ]);
          resolve(candles);
        } catch (e) {
          reject(new Error('JSON parse failed: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

// Chạy & ghi file
fetchBinance1mKlines()
  .then(candles => {
    const output = {
      symbol: 'BTCUSDT',
      interval: '1m',
      from: new Date(candles[0][0]).toISOString(),
      to: new Date(candles[candles.length - 1][0]).toISOString(),
      count: candles.length,
      candles: candles
    };
    fs.writeFileSync('btc_1m_24h.json', JSON.stringify(output, null, 2));
    console.log(`✅ Đã lưu ${candles.length} nến vào btc_1m_24h.json`);
    console.log(`🕒 Từ: ${output.from} → ${output.to}`);
    console.log(`💰 Giá hiện tại: $${candles[candles.length - 1][4].toFixed(2)}`);
  })
  .catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  });