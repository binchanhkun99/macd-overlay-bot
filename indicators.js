export function ema(data) {
  if (data.length === 0) return 0;
  const k = 2 / (data.length + 1);
  let val = data[0];
  for (let i = 1; i < data.length; i++) {
    val = data[i] * k + val * (1 - k);
  }
  return val;
}

export function sma(data) {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

export function getRecentSwing(klines) {
  const n = klines.length;
  if (n < 3) return { recentLow: 0, recentHigh: 0 };
  const recentLow = Math.min(klines[n-1].low, klines[n-2].low, klines[n-3].low);
  const recentHigh = Math.max(klines[n-1].high, klines[n-2].high, klines[n-3].high);
  return { recentLow, recentHigh };
}

export function checkVolume(klines, volumeRatio = 1.5) {
  if (klines.length < 21) return false;
  const vol20 = sma(klines.slice(-21, -1).map(k => k.volume));
  return klines[klines.length - 1].volume > vol20 * volumeRatio;
}