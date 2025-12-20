// testTelegram.js
import axios from 'axios';
import { CONFIG } from './config.js';

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = CONFIG;

async function testTelegram() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('YOUR_BOT_TOKEN')) {
    console.error('❌ TELEGRAM_BOT_TOKEN chưa được set hoặc vẫn là giá trị mặc định!');
    return;
  }

  if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID.includes('YOUR_CHAT_ID')) {
    console.error('❌ TELEGRAM_CHAT_ID chưa được set hoặc vẫn là giá trị mặc định!');
    return;
  }

  const message = `
 *TEST TELEGRAM NOTIFICATION*  
 Tét nô tì  
⏰ Time: ${new Date().toLocaleString('vi-VN')}
`.trim();

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }
    );

    if (response.data.ok) {
      console.log('✅ Gửi test message thành công!');
      console.log('Response:', response.data);
    } else {
      console.error('❌ Telegram trả về ok: false', response.data);
    }
  } catch (err) {
    if (err.response) {
      console.error(`❌ Lỗi HTTP ${err.response.status}: ${err.response.statusText}`);
      console.error('Detail:', err.response.data);
    } else {
      console.error('❌ Lỗi gửi request:', err.message);
    }
  }
}

// Chạy ngay khi file được execute
testTelegram();