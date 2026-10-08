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
function validReward(type, amount) {
  const types = new Set(['points', 'shards', 'money', 'pineapple', 'apple', 'grape']);
  return types.has(type) && Number.isInteger(amount) && amount > 0 && amount <= 100000000;
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
  const rows = readJson(RANKING_FILE, []).sort((a, b) => b.score - a.score).slice(0, 20);
  res.json({ rows });
});

app.post('/api/ranking', (req, res) => {
  const name = cleanName(req.body?.name);
  const score = Math.floor(Number(req.body?.score || 0));
  if (!name || score < 0 || score > Number.MAX_SAFE_INTEGER) return res.status(400).json({ error: 'ランキングデータが不正です' });
  const rows = readJson(RANKING_FILE, []);
  const existing = rows.find(x => x.name === name);
  if (existing) existing.score = Math.max(existing.score, score); else rows.push({ name, score, updatedAt: new Date().toISOString() });
  rows.sort((a, b) => b.score - a.score);
  writeJson(RANKING_FILE, rows.slice(0, 100));
  res.json({ rows: rows.slice(0, 20) });
});

app.get('/{*splat}', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`すいかクリッカー Ver.14 server started on ${PORT}`));
