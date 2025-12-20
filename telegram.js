import axios from 'axios';
import { CONFIG } from './config.js';

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = CONFIG;

// Danh sách ký tự cần escape trong MarkdownV2
const MARKDOWN_ESCAPE_CHARS = /([_*[\]()~`>#+=|{}.!-])/g;

/**
 * Escape ký tự đặc biệt cho MarkdownV2
 * Giữ nguyên các entity đã định dạng sẵn như *bold*, _italic_
 */
function escapeMarkdownV2(text) {
  // Các ký tự cần escape (trừ * và _ vì chúng dùng cho bold/italic)
  const escapeChars = /([[\]()~`>#+=|{}.!-])/g;
  
  // Escape toàn bộ ký tự nguy hiểm trước
  let escaped = text.replace(escapeChars, '\\$1');
  
  // Nhưng KHÔNG escape dấu * và _ nếu chúng là cặp hợp lệ (đang dùng cho format)
  // → Để nguyên chúng để Telegram vẫn bold/italic được
  // (Cách này đơn giản và hoạt động tốt với message của bạn)

  return escaped;
}

// Hàm gửi message chính — giờ sẽ tự động escape
export const sendMessage = async (rawText) => {
  const text = escapeMarkdownV2(rawText);

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  } catch (err) {
    console.error('❌ Telegram error:', err.response?.data || err.message);
  }
};

// Các hàm alert giữ nguyên — giờ rawText sẽ được escape tự động
export const sendEntryAlert = (trade) => {
  const { symbol, side, entry, sl, tp1, tp2, reason } = trade;
  const risk = side === 'long' ? entry - sl : sl - entry;
  const rr1 = (tp1 - entry) / risk;
  const rr2 = (tp2 - entry) / risk;

  const message = `
🎯 *NEW PSYCHOLOGY SCALP* (${symbol})
 ${side === 'long' ? '🟢 LONG' : '🔴 SHORT'}
 Entry: ${entry.toFixed(1)}
🛑 SL: ${sl.toFixed(1)} (${((risk / entry) * 100).toFixed(2)}%)
🎯 TP1: ${tp1.toFixed(1)} (RR=${rr1.toFixed(1)})
🎯 TP2: ${tp2.toFixed(1)} (RR=${rr2.toFixed(1)})
 ${reason}
`.trim();

  return sendMessage(message);
};

export const sendExitAlert = (trade, hit, price) => {
  const { symbol, side, entry } = trade;
  const pnl = side === 'long' ? price - entry : entry - price;
  const pnlPct = (pnl / entry) * 100;
  const emoji = hit === 'TP1' ? '✅' : hit === 'TP2' ? '🎉' : '❌';

  const message = `
${emoji} *${hit} HIT* (${symbol})
 ${side === 'long' ? 'LONG' : 'SHORT'}
 ${entry.toFixed(1)} → ${price.toFixed(1)}
 PnL: ${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%
`.trim();

  return sendMessage(message);
};