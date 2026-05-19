/**
 * OnaRoll PWA Service Worker
 * - Network-first strategy สำหรับ HTML/API (ข้อมูลใหม่เสมอเมื่อมีเน็ต)
 * - Cache-first สำหรับ static assets (CSS, JS, fonts, icons)
 * - Offline fallback: ใช้ cached version
 *
 * ⚠️ เมื่ออัปเดตไฟล์: เปลี่ยน CACHE_VERSION ด้านล่าง browser จะ install version ใหม่อัตโนมัติ
 */

const CACHE_VERSION = 'onaroll-v1.1.5';
const STATIC_CACHE  = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// Pre-cache: หน้าหลักที่ใช้บ่อย (โหลดมาเก็บตอน install)
const PRECACHE_URLS = [
  './',
  './index.html',
  './Owner_Dashboard.html',
  './Manager_Console.html',
  './Manager_Console_Inner.html',
  './Employee_Portal.html',
  './Daily_Checklist_System.html',
  './Checklist_Admin.html',
  './OR_Payroll_System.html',
  './Sales_Tracking.html',
  './Expenses.html',
  './manifest.json'
];

// ── INSTALL: pre-cache ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // ใช้ Promise.allSettled — ถ้าบาง URL fail (เช่น 404) ไม่ทำให้ทั้งระบบล่ม
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn('[SW] precache fail:', url, err.message)))
        );
      })
      .then(() => self.skipWaiting()) // activate ทันที ไม่ต้องรอ tab ปิด
  );
});

// ── ACTIVATE: clean old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // control existing tabs ทันที
  );
});

// ── FETCH: strategy routing ────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // ข้าม non-GET (POST/PUT — let it go through)
  if (req.method !== 'GET') return;

  // ข้าม chrome-extension://
  if (!url.protocol.startsWith('http')) return;

  // ── 1. Apps Script API → Network only (ห้าม cache ข้อมูลจาก backend) ─
  if (url.host.includes('script.google.com') || url.host.includes('googleusercontent.com')) {
    event.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ error: 'offline', _offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // ── 2. Google Sheets gviz → Network first, fallback cache ─
  if (url.host.includes('docs.google.com') || url.host.includes('spreadsheets.google.com')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── 3. ImgBB upload → Network only ─
  if (url.host.includes('api.imgbb.com')) {
    event.respondWith(fetch(req));
    return;
  }

  // ── 4. Google Fonts, CDN libs → Cache first ─
  if (url.host.includes('fonts.googleapis.com') ||
      url.host.includes('fonts.gstatic.com') ||
      url.host.includes('cdnjs.cloudflare.com') ||
      url.host.includes('cdn.jsdelivr.net') ||
      url.host.includes('cdn.tailwindcss.com')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // ── 5. Same-origin HTML/JS/CSS → Network first ─
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── 6. Default: network first ─
  event.respondWith(networkFirst(req));
});

// ── STRATEGIES ─────────────────────────────────────────

/**
 * Network-first: ลอง network ก่อน → cache → offline fallback
 * ใช้กับ HTML และ data ที่อยากให้สดใหม่
 */
async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    // เก็บ response ใหม่ลง runtime cache (ถ้า status ok)
    if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (e) {
    // network ล่ม → ใช้ cache
    const cached = await caches.match(req);
    if (cached) return cached;
    // ถ้าเป็น HTML และไม่มี cache → ส่ง offline page
    if (req.headers.get('accept')?.includes('text/html')) {
      return offlineHtml();
    }
    throw e;
  }
}

/**
 * Cache-first: ลอง cache ก่อน → fetch + เก็บ cache
 * ใช้กับ static assets ที่ไม่ค่อยเปลี่ยน
 */
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}

/** Offline fallback HTML — ใช้เมื่อขอ HTML แต่ไม่มีเน็ตและไม่มี cache */
function offlineHtml() {
  return new Response(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OnaRoll — ออฟไลน์</title>
<style>
body{margin:0;font-family:'Kanit',-apple-system,sans-serif;background:#1a2b5e;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center}
.box{max-width:320px}
.ic{font-size:64px;margin-bottom:16px}
h1{font-size:20px;margin:0 0 8px;font-weight:700}
p{font-size:14px;opacity:.7;line-height:1.6;margin:0 0 24px}
button{background:#fff;color:#1a2b5e;border:none;padding:12px 28px;border-radius:10px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}
</style>
</head>
<body>
  <div class="box">
    <div class="ic">📡</div>
    <h1>คุณกำลังออฟไลน์</h1>
    <p>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง</p>
    <button onclick="location.reload()">🔄 ลองอีกครั้ง</button>
  </div>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200
  });
}

// ── MESSAGE: รองรับ skipWaiting trigger จาก client ─────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
