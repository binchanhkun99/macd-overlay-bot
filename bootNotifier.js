import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'state.json');

// Lấy version từ package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const CURRENT_VERSION = packageJson.version;

// Lấy IP local (ưu tiên IPv4)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Đọc state
function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('⚠️ Failed to read state.json, resetting...');
  }
  return null;
}

// Ghi state
function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function escapeMarkdownV2(text) {
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}
// Gửi alert khởi động
async function sendBootAlert() {
  const env = process.env.NODE_ENV || 'development';
  const ip = getLocalIP();
  const now = new Date().toISOString();
// 📍 IP: ${ip} 
  const rawMessage = `
 *SCALP BOT STARTED*  
 Version: ${CURRENT_VERSION}  
 Environment: ${env}  
 IP: TP. Hồ Chí Minh  
 Time: ${new Date().toLocaleString()}  
 Host: ${os.hostname()}
`.trim();
const message = escapeMarkdownV2(rawMessage);
  try {
    await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2'
    });
    console.log('✅ Boot alert sent to Telegram');

    // Cập nhật state
    const newState = {
      lastBootVersion: CURRENT_VERSION,
      lastBootTime: now,
      lastBootEnv: env,
      lastBootIP: ip
    };
    writeState(newState);
  } catch (err) {
    console.error('❌ Failed to send boot alert:', err.message);
  }
}

// Kiểm tra & gửi nếu cần
export async function checkAndNotifyBoot() {
  const state = readState();
  
  if (!state || state.lastBootVersion !== CURRENT_VERSION) {
    console.log(`🚀 New version detected: ${state?.lastBootVersion} → ${CURRENT_VERSION}`);
    await sendBootAlert();
  } else {
    console.log(`🔄 Rebooted (v${CURRENT_VERSION}), no alert needed`);
  }
}