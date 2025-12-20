import WebSocket from 'ws';
import axios from 'axios';
import { CONFIG } from './config.js';
import { analyzePsychology } from './psychology.js';
import { sendEntryAlert } from './telegram.js';
import { info, warn, error, debug } from './logger.js';
import { addTrade, getTrade, activeTrades, startMonitoring } from './tradeManager.js'; 
import { checkAndNotifyBoot } from './bootNotifier.js';  
// Tạo global cache
global.klineCache = new Map();

// Lấy nến cũ
async function fetchKlines(symbol) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${CONFIG.INTERVAL}&limit=100`;
  const res = await axios.get(url);
  return res.data.map(k => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

// Khởi tạo
async function init() {
  info('🔄 Starting bot initialization...');
  for (const symbol of CONFIG.SYMBOLS) {
    try {
      const klines = await fetchKlines(symbol);
      global.klineCache.set(symbol, klines);
      info(`✅ ${symbol}: Loaded ${klines.length} klines`, {
        first: klines[0]?.close,
        last: klines[klines.length-1]?.close,
        volumeLast: klines[klines.length-1]?.volume
      });
    } catch (err) {
      error(`❌ Failed to load klines for ${symbol}`, { error: err.message });
    }
  }
  
  info('⚙️ Bot config', {
    symbols: CONFIG.SYMBOLS,
    interval: CONFIG.INTERVAL,
    maxActiveTrades: CONFIG.MAX_ACTIVE_TRADES
  });

  startMonitoring(); // ✅ Giờ đã được import đúng
  info('🚀 Scalp Psychology Bot — Alert Only — started!');
}

// Xử lý nến mới
function onKline(symbol, kline) {
  const cache = global.klineCache.get(symbol);
  if (!cache) return;

  debug(`📥 ${symbol} kline`, {
    time: new Date().toLocaleTimeString(),
    close: kline.close,
    volume: kline.volume,
    isClosed: kline.isClosed
  });

  if (kline.isClosed) {
    cache.push(kline);
    if (cache.length > 100) cache.shift();

    const active = getTrade(symbol);
    if (active) {
      debug(`👁️  Tracking ${symbol}`, {
        side: active.side,
        entry: active.entry,
        sl: active.sl
      });
    }

    const signal = analyzePsychology(cache);
    
    if (signal) {
      info(`🎯 Signal detected: ${symbol} ${signal.side}`, signal);
      
      if (activeTrades.size >= CONFIG.MAX_ACTIVE_TRADES) {
        warn(`⏭️  Skip ${symbol}: max active trades reached`);
        return;
      }
      if (active) {
        warn(`⏭️  Skip ${symbol}: already tracking`);
        return;
      }

      const trade = { symbol, ...signal, tp1Hit: false };
      addTrade(symbol, trade);
      sendEntryAlert(trade);
      info(`✅ Trade added: ${symbol}`, trade);
    }
  }
}

// WebSocket
function connect(symbol) {
  const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_15m`);
  
  ws.on('open', () => info(`📡 WebSocket connected: ${symbol}`));
  ws.on('close', () => warn(`🔌 WebSocket closed: ${symbol}`));
  ws.on('error', (err) => error(`⚠️ WebSocket error: ${symbol}`, { error: err.message }));
  
  ws.on('message', (data) => {
    try {
//   console.log(`📡 Raw data from ${symbol}:`, data.toString().substring(0, 100) + '...');

      const msg = JSON.parse(data);
      const k = msg.k;
      onKline(symbol, {
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        isClosed: k.x
      });
    } catch (err) {
      error(`💥 Parse error on ${symbol}`, { error: err.message });
    }
  });
}

// --- RUN ---
(async () => {
  await init();
  CONFIG.SYMBOLS.forEach(connect);
   setTimeout(() => {
    checkAndNotifyBoot().catch(console.error);
  }, 3000);
})();