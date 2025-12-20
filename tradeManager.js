import { sendExitAlert } from './telegram.js';
import { info } from './logger.js';

// Export activeTrades để bot.js truy cập
export const activeTrades = new Map();

export function addTrade(symbol, trade) {
  activeTrades.set(symbol, trade);
  info(`➕ Added trade: ${symbol}`, { side: trade.side, entry: trade.entry });
}

export function removeTrade(symbol) {
  const trade = activeTrades.get(symbol);
  if (trade) {
    info(`➖ Removed trade: ${symbol}`, { side: trade.side, entry: trade.entry });
    activeTrades.delete(symbol);
  }
}

export function getTrade(symbol) {
  return activeTrades.get(symbol);
}

// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
// PHẢI EXPORT startMonitoring thì bot.js mới gọi được
// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
export function startMonitoring() {
  setInterval(() => {
    if (activeTrades.size === 0) {
      // console.log('💤 No active trades');
      return;
    }

    for (const [symbol, trade] of activeTrades) {
      const klines = global.klineCache?.get(symbol);
      if (!klines || klines.length === 0) continue;

      const latest = klines[klines.length - 1];
      const high = latest.high;
      const low = latest.low;

      let hit = null, price = 0;

      if (trade.side === 'long') {
        if (high >= trade.tp2) { hit = 'TP2'; price = trade.tp2; }
        else if (high >= trade.tp1 && !trade.tp1Hit) { hit = 'TP1'; price = trade.tp1; trade.tp1Hit = true; }
        else if (low <= trade.sl) { hit = 'SL'; price = trade.sl; }
      } else {
        if (low <= trade.tp2) { hit = 'TP2'; price = trade.tp2; }
        else if (low <= trade.tp1 && !trade.tp1Hit) { hit = 'TP1'; price = trade.tp1; trade.tp1Hit = true; }
        else if (high >= trade.sl) { hit = 'SL'; price = trade.sl; }
      }

      if (hit) {
        sendExitAlert(trade, hit, price);
        info(`🔔 ${hit} hit: ${symbol}`, { 
          side: trade.side, 
          entry: trade.entry, 
          exit: price, 
          pnlPct: ((price - trade.entry) / trade.entry * 100).toFixed(2) + '%'
        });
        
        if (hit === 'TP2' || hit === 'SL') {
          removeTrade(symbol);
        }
      }
    }
  }, 1000);
}