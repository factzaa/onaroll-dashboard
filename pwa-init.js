/**
 * 📱 OnaRoll PWA Init
 *
 * วิธีใช้: copy 3 บรรทัดนี้ไปวางใน <head> ของทุก HTML page:
 *
 *   <link rel="manifest" href="manifest.json">
 *   <meta name="theme-color" content="#1a2b5e">
 *   <link rel="apple-touch-icon" href="icons/icon-192.png">
 *   <script src="pwa-init.js" defer></script>
 *
 * ระบบจะ:
 *  ✅ ลงทะเบียน service worker
 *  ✅ แสดง prompt "เพิ่มลงหน้าจอหลัก" บน Android (Chrome)
 *  ✅ แสดงคำแนะนำ install สำหรับ iOS Safari (manual instruction)
 *  ✅ Auto-update เมื่อมีโค้ดใหม่
 */

(function() {
  'use strict';

  // ── 1. REGISTER SERVICE WORKER ───────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js', { scope: './' })
        .then(reg => {
          console.log('[PWA] ✅ Service Worker registered:', reg.scope);

          // เช็คมี update ใหม่ทุก 1 ชม.
          setInterval(() => reg.update().catch(()=>{}), 60 * 60 * 1000);

          // ถ้ามี SW ใหม่กำลัง install → แสดง notify
          reg.addEventListener('updatefound', () => {
            const newSW = reg.installing;
            if (!newSW) return;
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner(reg);
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] ❌ SW registration failed:', err));

      // เมื่อ controller เปลี่ยน (SW ใหม่ active) → reload หน้า
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  // ── 2. INSTALL PROMPT (Android Chrome) ───────────────
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    // หลัง 5 วินาที (ให้ user เห็นหน้าเว็บก่อน) → แสดงปุ่ม
    setTimeout(() => {
      if (!isInstalled() && !installPromptDismissed()) showInstallBanner();
    }, 5000);
  });

  // เมื่อติดตั้งสำเร็จ
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] 🎉 App installed!');
    deferredInstallPrompt = null;
    hideInstallBanner();
    showToast('🎉 ติดตั้ง OnaRoll สำเร็จ! เปิดได้จากหน้าจอหลัก');
  });

  // ── 3. iOS INSTALL HINT ──────────────────────────────
  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }
  function isInstalled() { return isStandalone(); }

  // แสดงคำแนะนำ install สำหรับ iOS (ครั้งแรกเท่านั้น)
  window.addEventListener('load', () => {
    if (isIOS() && !isStandalone() && !installPromptDismissed()) {
      setTimeout(() => showIOSInstallBanner(), 5000);
    }
  });

  // ── 4. HELPERS ────────────────────────────────────────
  function installPromptDismissed() {
    try {
      const t = localStorage.getItem('pwa_dismissed_at');
      if (!t) return false;
      // dismissed within 7 days = skip
      return (Date.now() - parseInt(t, 10)) < 7 * 24 * 60 * 60 * 1000;
    } catch(e) { return false; }
  }
  function dismissInstall() {
    try { localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch(e) {}
    hideInstallBanner();
  }

  // ── 5. UI: Install banner ────────────────────────────
  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <style>
        #pwa-install-banner{position:fixed;bottom:16px;left:16px;right:16px;max-width:420px;margin:0 auto;background:#1a2b5e;color:#fff;border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:'Kanit',-apple-system,sans-serif;animation:pwaSlideUp .35s ease-out}
        @keyframes pwaSlideUp{from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}}
        #pwa-install-banner .pwa-ic{font-size:28px;flex-shrink:0}
        #pwa-install-banner .pwa-txt{flex:1;line-height:1.3}
        #pwa-install-banner .pwa-title{font-size:13px;font-weight:700;margin-bottom:2px}
        #pwa-install-banner .pwa-sub{font-size:11px;opacity:.75}
        #pwa-install-banner .pwa-btn{background:#fff;color:#1a2b5e;border:none;padding:8px 14px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
        #pwa-install-banner .pwa-close{background:transparent;border:none;color:rgba(255,255,255,.5);font-size:20px;cursor:pointer;padding:0 4px;line-height:1}
      </style>
      <div class="pwa-ic">📱</div>
      <div class="pwa-txt">
        <div class="pwa-title">ติดตั้ง OnaRoll</div>
        <div class="pwa-sub">เปิดเร็วกว่า ใช้ออฟไลน์ได้</div>
      </div>
      <button class="pwa-btn" id="pwa-install-btn">ติดตั้ง</button>
      <button class="pwa-close" id="pwa-close-btn" aria-label="ปิด">×</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('pwa-install-btn').onclick = async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('[PWA] install outcome:', outcome);
      if (outcome === 'accepted') hideInstallBanner();
      else dismissInstall();
      deferredInstallPrompt = null;
    };
    document.getElementById('pwa-close-btn').onclick = dismissInstall;
  }

  function showIOSInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <style>
        #pwa-install-banner{position:fixed;bottom:16px;left:16px;right:16px;max-width:420px;margin:0 auto;background:#1a2b5e;color:#fff;border-radius:16px;padding:16px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:'Kanit',-apple-system,sans-serif;animation:pwaSlideUp .35s ease-out}
        @keyframes pwaSlideUp{from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}}
        #pwa-install-banner .pwa-row{display:flex;align-items:flex-start;gap:12px}
        #pwa-install-banner .pwa-ic{font-size:28px;flex-shrink:0}
        #pwa-install-banner .pwa-txt{flex:1;line-height:1.4}
        #pwa-install-banner .pwa-title{font-size:13px;font-weight:700;margin-bottom:4px}
        #pwa-install-banner .pwa-sub{font-size:11px;opacity:.85;line-height:1.5}
        #pwa-install-banner .pwa-close{background:transparent;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0}
        #pwa-install-banner .ios-step{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:rgba(255,255,255,.15);border-radius:5px;font-weight:600;margin:0 2px}
      </style>
      <div class="pwa-row">
        <div class="pwa-ic">📲</div>
        <div class="pwa-txt">
          <div class="pwa-title">ติดตั้งบน iPhone/iPad</div>
          <div class="pwa-sub">
            แตะ <span class="ios-step">⬆️ แชร์</span>
            ด้านล่าง แล้วเลือก
            <span class="ios-step">➕ เพิ่มลงในหน้าจอหลัก</span>
          </div>
        </div>
        <button class="pwa-close" id="pwa-close-btn" aria-label="ปิด">×</button>
      </div>
    `;
    document.body.appendChild(banner);
    document.getElementById('pwa-close-btn').onclick = dismissInstall;
  }

  function hideInstallBanner() {
    const el = document.getElementById('pwa-install-banner');
    if (el) el.remove();
  }

  function showUpdateBanner(reg) {
    if (document.getElementById('pwa-update-banner')) return;
    const b = document.createElement('div');
    b.id = 'pwa-update-banner';
    b.innerHTML = `
      <style>
        #pwa-update-banner{position:fixed;top:16px;left:16px;right:16px;max-width:420px;margin:0 auto;background:#10b981;color:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:9998;box-shadow:0 6px 20px rgba(0,0,0,.25);font-family:'Kanit',-apple-system,sans-serif;font-size:13px;animation:pwaSlideDown .3s ease-out}
        @keyframes pwaSlideDown{from{transform:translateY(-120%)}to{transform:translateY(0)}}
        #pwa-update-banner .pwa-update-btn{background:#fff;color:#10b981;border:none;padding:6px 12px;border-radius:6px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;margin-left:auto}
      </style>
      <span>🚀</span>
      <span>มีเวอร์ชั่นใหม่!</span>
      <button class="pwa-update-btn">อัปเดต</button>
    `;
    document.body.appendChild(b);
    b.querySelector('.pwa-update-btn').onclick = () => {
      reg.waiting?.postMessage('SKIP_WAITING');
    };
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2b5e;color:#fff;padding:12px 20px;border-radius:10px;font-family:Kanit,-apple-system,sans-serif;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:10000;white-space:nowrap';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ── EXPOSE for manual trigger (debug) ────────────────
  window.OnaRollPWA = {
    triggerInstall: () => deferredInstallPrompt?.prompt(),
    isInstalled,
    isIOS,
    clearDismiss: () => localStorage.removeItem('pwa_dismissed_at')
  };
})();
