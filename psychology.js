import { ema, sma, getRecentSwing, checkVolume } from './indicators.js';
import { CONFIG } from './config.js';

export function analyzePsychology(klines) {
  if (klines.length < 30) return null;

  const closes = klines.map(k => k.close);
  const ema14 = ema(closes.slice(-CONFIG.EMA_PERIOD));
  // Tạo lịch sử EMA
  const emaHist = [];
  for (let i = CONFIG.EMA_PERIOD; i <= closes.length; i++) {
    emaHist.push(ema(closes.slice(i - CONFIG.EMA_PERIOD, i)));
  }
  if (emaHist.length < CONFIG.SIGNAL_SMA_PERIOD) return null;
  
  const signal = sma(emaHist.slice(-CONFIG.SIGNAL_SMA_PERIOD));
  const prevEMA = emaHist[emaHist.length - 2];
  const prevSignal = sma(emaHist.slice(-CONFIG.SIGNAL_SMA_PERIOD - 1, -1));

  const crossUp = prevEMA <= prevSignal && ema14 > signal;
  const crossDown = prevEMA >= prevSignal && ema14 < signal;

  if (!crossUp && !crossDown) return null;
  if (!checkVolume(klines, CONFIG.VOLUME_RATIO)) return null;
  const { recentLow, recentHigh } = getRecentSwing(klines);
  const current = klines[klines.length - 1];
  const price = current.close;

  let side, entry, sl, tp1, tp2, reason;

  if (crossUp) {
    const isBullishTrap = current.low < recentLow * 0.999 && current.close > recentLow;
    const isRetest = Math.abs(price - ema14) / ema14 < CONFIG.RETEST_TOLERANCE;
    if (isBullishTrap && isRetest) {
      side = 'long';
      entry = price;
      sl = recentLow * 0.998;
      const risk = entry - sl;
      tp1 = entry + risk * CONFIG.TP1_RR;
      tp2 = entry + risk * CONFIG.TP2_RR;
      reason = `✅ Bullish trap + retest EMA14`;
    }
  } else if (crossDown) {
    const isBearishTrap = current.high > recentHigh * 1.001 && current.close < recentHigh;
    const isRetest = Math.abs(price - ema14) / ema14 < CONFIG.RETEST_TOLERANCE;
    if (isBearishTrap && isRetest) {
      side = 'short';
      entry = price;
      sl = recentHigh * 1.002;
      const risk = sl - entry;
      tp1 = entry - risk * CONFIG.TP1_RR;
      tp2 = entry - risk * CONFIG.TP2_RR;
      reason = `✅ Bearish trap + retest EMA14`;
    }
  }

  return side ? { side, entry, sl, tp1, tp2, reason } : null;
}