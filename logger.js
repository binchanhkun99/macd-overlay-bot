import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tạo thư mục logs nếu chưa có
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const LOG_FILE = path.join(LOG_DIR, `scalp-bot-${new Date().toISOString().slice(0, 10)}.log`);

export const log = (level, message, meta = {}) => {
  const now = new Date().toISOString();
  const logLine = `[${now}] [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}\n`;
  
  // In ra console với màu
  const color = level === 'ERROR' ? '\x1b[31m' : 
                level === 'WARN'  ? '\x1b[33m' : 
                level === 'INFO'  ? '\x1b[36m' : '\x1b[37m';
  console.log(`${color}${logLine}\x1b[0m`);

  // Ghi vào file
  fs.appendFileSync(LOG_FILE, logLine);
};

// Shortcut
export const info = (msg, meta) => log('INFO', msg, meta);
export const warn = (msg, meta) => log('WARN', msg, meta);
export const error = (msg, meta) => log('ERROR', msg, meta);
export const debug = (msg, meta) => {
  if (process.env.DEBUG === 'true') log('DEBUG', msg, meta);
};