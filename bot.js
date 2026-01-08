import WebSocket from 'ws';
import axios from 'axios';
import { CONFIG } from './config.js';
import { analyzePsychology } from './psychology.js';
import { sendEntryAlert } from './telegram.js';
import { info, warn, error, debug } from './logger.js';
import { addTrade, getTrade, activeTrades, startMonitoring } from './tradeManager.js'; 
import { checkAndNotifyBoot } from './bootNotifier.js';  

// Tạo global cache và lưu WebSocket instances
global.klineCache = new Map();
global.wsInstances = {};
global.lastDataTime = {};

// 🔧 SỬA LỖI: URL có khoảng trắng → 400 error
async function fetchKlines(symbol) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${CONFIG.INTERVAL}&limit=100`;
  const res = await axios.get(url);
  return res.data.map(k => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    timestamp: k[0]
  }));
}

// 🔄 KẾT NỐI WEBSOCKET CÓ RECONNECT
function connectWithReconnect(symbol, maxRetries = 10) {
  let reconnectCount = 0;
  let shouldReconnect = true;

  const connect = () => {
    if (!shouldReconnect) return;

    const wsUrl = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_15m`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      reconnectCount = 0;
      info(`📡 WebSocket connected: ${symbol}`);
    });

    ws.on('close', () => {
      warn(`🔌 WebSocket closed: ${symbol}`);
      if (shouldReconnect && reconnectCount < maxRetries) {
        const delay = Math.min(2000 * Math.pow(1.5, reconnectCount), 30000); // exponential backoff
        warn(`⏳ Reconnecting ${symbol} in ${delay}ms... (attempt ${reconnectCount + 1})`);
        setTimeout(() => {
          reconnectCount++;
          connect();
        }, delay);
      }
    });

    ws.on('error', (err) => {
      error(`⚠️ WebSocket error: ${symbol}`, { error: err.message });
      ws.close(); // force close để trigger reconnect
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        const k = msg.k;
        onKline(symbol, {
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          timestamp: k.t,
          isClosed: k.x
        });
      } catch (err) {
        error(`💥 Parse error on ${symbol}`, { error: err.message });
      }
    });

    global.wsInstances[symbol] = ws;
  };

  connect();
}

// Xử lý nến mới
function onKline(symbol, kline) {
  // 🩺 CẬP NHẬT THỜI GIAN NHẬN DATA GẦN NHẤT
  if (kline.timestamp) {
    global.lastDataTime[symbol] = kline.timestamp;
  }

  const cache = global.klineCache.get(symbol);
  if (!cache) return;

  debug(`📥 ${symbol} kline`, {
    time: new Date(kline.timestamp).toLocaleTimeString(),
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

// 🩺 HEALTH CHECK: PHÁT HIỆN CHẾT LẶNG
setInterval(() => {
  const now = Date.now();
  for (const symbol of CONFIG.SYMBOLS) {
    const lastTime = global.lastDataTime[symbol] || 0;
    const minutesSinceLast = (now - lastTime) / 60000;
    
    // M15 nên có data mỗi 15p → cảnh báo nếu >16p
    if (minutesSinceLast > 16) {
      warn(`🚨 ${symbol} no data for ${minutesSinceLast.toFixed(1)} minutes — force reconnect`);
      try {
        global.wsInstances[symbol]?.close();
      } catch (err) {
        error(`❌ Failed to close WS for ${symbol}`, { error: err.message });
      }
    }
  }
}, 60000); // kiểm tra mỗi phút

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

  startMonitoring();
  info('🚀 Scalp Psychology Bot — Alert Only — started!');
}

// --- RUN ---
(async () => {
  await init();
  CONFIG.SYMBOLS.forEach(symbol => connectWithReconnect(symbol));
  
  // Gửi boot alert sau 3s
  setTimeout(() => {
    checkAndNotifyBoot().catch(console.error);
  }, 3000);
})();