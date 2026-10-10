const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');
const RANKING_FILE = path.join(DATA_DIR, 'ranking.json');
const sessions = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function makeCode() {
  return 'SUICA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function cleanName(s) {
  return String(s || '').trim().replace(/[<>"'`]/g, '').slice(0, 12);
}
function normalizeScore(value) {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!/^\d{1,1000}$/.test(raw)) return null;
    return raw.replace(/^0+(?=\d)/, '');
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const raw = String(Math.floor(value));
  if (!/[eE]/.test(raw)) return raw;
  const [mantissa, exponentText] = raw.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const parts = mantissa.split('.');
  const digits = parts.join('');
  const decimalPosition = parts[0].length + exponent;
  if (decimalPosition <= 0) return '0';
  if (decimalPosition >= digits.length) return digits + '0'.repeat(Math.min(1000, decimalPosition - digits.length));
  return digits.slice(0, decimalPosition);
}
function compareScoresDescending(a, b) {
  const left = normalizeScore(a?.score) || '0';
  const right = normalizeScore(b?.score) || '0';
  const x = BigInt(left), y = BigInt(right);
  return x > y ? -1 : x < y ? 1 : 0;
}
function validReward(type, amount) {
  const types = new Set(['points', 'shards', 'money', 'pineapple', 'apple', 'grape']);
  return types.has(type) && Number.isSafeInteger(amount) && amount > 0;
}
function adminToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return '';
  const token = h.slice(7);
  return sessions.has(token) ? token : '';
}

// GitHub PagesからRender APIへ接続できるようCORSを許可
app.use((req,res,next)=>{const origin=req.headers.origin;if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next()});
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORDがサーバーに設定されていません' });
  if (String(req.body?.password || '') !== ADMIN_PASSWORD) return res.status(401).json({ error: 'パスワードが違います' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now());
  setTimeout(() => sessions.delete(token), 8 * 60 * 60 * 1000);
  res.json({ token });
});

app.post('/api/admin/create-code', (req, res) => {
  if (!adminToken(req)) return res.status(401).json({ error: '管理者ログインが必要です' });
  const type = String(req.body?.type || '');
  const amount = Math.floor(Number(req.body?.amount || 0));
  if (!validReward(type, amount)) return res.status(400).json({ error: '報酬の種類または数量が不正です' });
  const codes = readJson(CODES_FILE, []);
  let code = makeCode();
  while (codes.some(x => x.code === code)) code = makeCode();
  codes.push({ code, type, amount, createdAt: new Date().toISOString(), usedAt: null });
  writeJson(CODES_FILE, codes);
  res.json({ code, type, amount });
});

app.post('/api/redeem', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'コードを入力してください' });
  const codes = readJson(CODES_FILE, []);
  const row = codes.find(x => x.code === code);
  if (!row) return res.status(404).json({ error: 'そのコードは存在しません' });
  if (row.usedAt) return res.status(409).json({ error: 'このコードはすでに使用済みです' });
  row.usedAt = new Date().toISOString();
  writeJson(CODES_FILE, codes);
  res.json({ ok: true, type: row.type, amount: row.amount });
});

app.get('/api/ranking', (req, res) => {
  const stored = readJson(RANKING_FILE, []);
  const rows = (Array.isArray(stored) ? stored : []).sort(compareScoresDescending).slice(0, 20);
  res.json({ rows });
});

app.post('/api/ranking', (req, res) => {
  const name = cleanName(req.body?.name);
  const score = normalizeScore(req.body?.score);
  if (!name || score === null) return res.status(400).json({ error: 'ランキング名またはポイントが不正です' });
  const stored = readJson(RANKING_FILE, []);
  const rows = Array.isArray(stored) ? stored : [];
  const existing = rows.find(x => x.name === name);
  if (existing) {
    const oldScore = normalizeScore(existing.score) || '0';
    existing.score = BigInt(oldScore) >= BigInt(score) ? oldScore : score;
    existing.updatedAt = new Date().toISOString();
  } else {
    rows.push({ name, score, updatedAt: new Date().toISOString() });
  }
  rows.sort(compareScoresDescending);
  writeJson(RANKING_FILE, rows.slice(0, 100));
  res.json({ rows: rows.slice(0, 20) });
});

app.get('/{*splat}', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`すいかクリッカー Ver.14 server started on ${PORT}`));
