const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const SESSION_SECRET = process.env.SESSION_SECRET || 'rotate-me';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TABLE = 'directory';

// ---------- supabase fetch ----------
async function sbGet() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?order=id.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  if (!res.ok) throw new Error('Supabase GET failed: ' + await res.text());
  const rows = await res.json();
  if (!rows.length) return { company: { name: 'hippo.uz' }, departments: [] };
  return JSON.parse(rows[0].data);
}

async function sbSet(payload) {
  // upsert single row with id=1
  const body = JSON.stringify([{ id: 1, data: JSON.stringify(payload) }]);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body,
  });
  if (!res.ok) throw new Error('Supabase SET failed: ' + await res.text());
}

// ---------- auth ----------
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.exp && p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}
function isAdmin(req) { return verifyToken(req.cookies?.hd_session)?.role === 'admin'; }
function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  if (!req.path.startsWith('/api/')) return res.redirect('/admin/login');
  res.status(401).json({ error: 'unauthorized' });
}

// ---------- middleware ----------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- public API ----------
app.get('/api/data', async (req, res) => {
  try { res.json(await sbGet()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- auth API ----------
app.post('/api/auth/login', (req, res) => {
  if (req.body?.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'invalid password' });
  const token = signToken({ role: 'admin', iat: Date.now(), exp: Date.now() + 30*24*60*60*1000 });
  res.cookie('hd_session', token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30*24*60*60*1000,
  });
  res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('hd_session'); res.json({ ok: true }); });
app.get('/api/auth/status', (req, res) => res.json({ isAdmin: isAdmin(req) }));

// ---------- admin API ----------
function sanitizePerson(p) {
  return {
    id: p.id || crypto.randomUUID(),
    name: String(p.name || '').trim(),
    position: String(p.position || '').trim(),
    email: String(p.email || '').trim(),
    phone: String(p.phone || '').trim(),
    telegram: String(p.telegram || '').trim().replace(/^@+/, ''),
  };
}

app.put('/api/data', requireAdmin, async (req, res) => {
  const incoming = req.body;
  if (!incoming || !Array.isArray(incoming.departments))
    return res.status(400).json({ error: 'invalid payload' });
  const payload = {
    company: incoming.company || { name: 'hippo.uz' },
    departments: incoming.departments.map(d => ({
      id: d.id || crypto.randomUUID(),
      name: String(d.name || '').trim(),
      description: String(d.description || '').trim(),
      responsibilities: Array.isArray(d.responsibilities) ? d.responsibilities.filter(Boolean) : [],
      head: d.head ? sanitizePerson(d.head) : null,
      employees: Array.isArray(d.employees) ? d.employees.map(sanitizePerson) : [],
    })),
    updatedAt: new Date().toISOString(),
  };
  try { await sbSet(payload); res.json(payload); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- HTML ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/public.html')));
app.get('/admin/login', (req, res) => {
  if (isAdmin(req)) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'views/login.html'));
});
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views/admin.html')));

app.listen(PORT, () => console.log(`hippo.uz directory on :${PORT}`));
