/**
 * 📱 OnaRoll PWA Init v2 — Manual Install Button
 *
 * - แสดงปุ่ม "ติดตั้งแอป" บนหน้าจอตลอดเวลา (ถ้ายังไม่ได้ติดตั้ง)
 * - แก้ปัญหา banner ไม่เด้ง / dismiss ค้าง
 * - รองรับ Android Chrome + iOS Safari
 */

(function() {
  'use strict';

  // ── 1. REGISTER SERVICE WORKER ───────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js', { scope: './' })
        .then(reg => {
          console.log('[PWA] ✅ Service Worker registered:', reg.scope);
          setInterval(() => reg.update().catch(()=>{}), 60 * 60 * 1000);
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

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  // ── 2. CAPTURE INSTALL PROMPT ──────────────────────────
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] 📦 beforeinstallprompt captured — ready to install');
    // แสดงปุ่มถาวร (ถ้ายังไม่แสดง)
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] 🎉 App installed!');
    deferredInstallPrompt = null;
    hideInstallButton();
    showToast('🎉 ติดตั้ง OnaRoll สำเร็จ! เปิดได้จากหน้าจอหลัก');
  });

  // ── 3. PLATFORM DETECTION ───────────────────────────
  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
  }
  function isSafari() {
    return /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
  }
  function isInAppBrowser() {
    // LINE, Facebook, Instagram in-app browsers
    const ua = navigator.userAgent;
    return /Line\/|FBAN|FBAV|Instagram/i.test(ua);
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }

  // ── 4. SHOW INSTALL BUTTON ON LOAD ───────────────
  window.addEventListener('load', () => {
    // ถ้าติดตั้งแล้ว — ไม่แสดงปุ่ม
    if (isStandalone()) {
      console.log('[PWA] Running in standalone mode (installed)');
      return;
    }
    
    // ถ้าใน in-app browser — แสดง warning แทน
    if (isInAppBrowser()) {
      setTimeout(() => showInAppBrowserWarning(), 3000);
      return;
    }
    
    // iOS Safari — ไม่มี beforeinstallprompt event → แสดงปุ่ม + instruction
    if (isIOS()) {
      showInstallButton();
      return;
    }
    
    // Android Chrome — รอ beforeinstallprompt
    // ถ้าผ่าน 3 วินาทีแล้วยังไม่มี → แสดงปุ่มอยู่ดี (เผื่อ user กดเอง)
    setTimeout(() => {
      if (!isStandalone()) showInstallButton();
    }, 3000);
  });

  // ── 5. UI: Install Button (ถาวรในมุมจอ) ────────────────
  function showInstallButton() {
    if (document.getElementById('pwa-install-btn-fixed')) return;
    const btn = document.createElement('div');
    btn.id = 'pwa-install-btn-fixed';
    btn.innerHTML = `
      <style>
        #pwa-install-btn-fixed{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a2b5e,#0f1d44);color:#fff;border-radius:30px;padding:12px 20px;display:flex;align-items:center;gap:10px;z-index:9999;box-shadow:0 8px 24px rgba(26,43,94,.45),0 0 0 2px rgba(255,255,255,.1) inset;font-family:'Kanit',-apple-system,sans-serif;cursor:pointer;animation:pwaPulse 2.5s infinite,pwaPopIn .4s ease-out;max-width:90vw}
        @keyframes pwaPulse{0%,100%{box-shadow:0 8px 24px rgba(26,43,94,.45),0 0 0 2px rgba(255,255,255,.1) inset}50%{box-shadow:0 8px 24px rgba(26,43,94,.45),0 0 0 4px rgba(59,130,246,.4) inset}}
        @keyframes pwaPopIn{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        #pwa-install-btn-fixed:active{transform:translateX(-50%) scale(.96)}
        #pwa-install-btn-fixed .pwa-ic{font-size:20px}
        #pwa-install-btn-fixed .pwa-label{font-size:13px;font-weight:700;letter-spacing:.3px;white-space:nowrap}
        #pwa-install-btn-fixed .pwa-close{margin-left:6px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:14px;cursor:pointer;padding:2px 8px;border-radius:50%;line-height:1}
      </style>
      <div class="pwa-ic">📲</div>
      <div class="pwa-label">ติดตั้งแอป OnaRoll</div>
      <button class="pwa-close" id="pwa-install-close" aria-label="ปิด">×</button>
    `;
    document.body.appendChild(btn);
    
    btn.addEventListener('click', (e) => {
      if (e.target.id === 'pwa-install-close') {
        hideInstallButton();
        return;
      }
      triggerInstall();
    });
  }

  function hideInstallButton() {
    const el = document.getElementById('pwa-install-btn-fixed');
    if (el) el.remove();
  }

  // ── 6. TRIGGER INSTALL ─────────────────────────────
  async function triggerInstall() {
    // Android Chrome — ใช้ deferred prompt
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('[PWA] install outcome:', outcome);
        if (outcome === 'accepted') hideInstallButton();
        deferredInstallPrompt = null;
      } catch(e) {
        console.warn('[PWA] install prompt error:', e);
        showInstallInstructions();
      }
      return;
    }
    
    // iOS หรือ Chrome ที่ไม่มี prompt → แสดง instruction modal
    showInstallInstructions();
  }

  // ── 7. INSTALL INSTRUCTIONS MODAL ──────────────────
  function showInstallInstructions() {
    if (document.getElementById('pwa-instructions-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'pwa-instructions-modal';
    const ios = isIOS();
    const chromeAndroid = !ios && /Android/i.test(navigator.userAgent);
    
    modal.innerHTML = `
      <style>
        #pwa-instructions-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Kanit',-apple-system,sans-serif;animation:fadeInPwa .25s}
        @keyframes fadeInPwa{from{opacity:0}to{opacity:1}}
        #pwa-instructions-modal .modal-card{background:linear-gradient(160deg,#1a2b5e,#0f1d44);color:#fff;border-radius:20px;padding:26px 22px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:slideUpPwa .3s}
        @keyframes slideUpPwa{from{transform:translateY(30px) scale(.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
        #pwa-instructions-modal .modal-title{font-size:18px;font-weight:700;margin-bottom:6px;text-align:center}
        #pwa-instructions-modal .modal-sub{font-size:12px;color:rgba(255,255,255,.65);margin-bottom:18px;text-align:center}
        #pwa-instructions-modal .step{display:flex;gap:12px;padding:12px;background:rgba(255,255,255,.06);border-radius:12px;margin-bottom:8px;align-items:center}
        #pwa-instructions-modal .step-num{background:#3b82f6;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:13px}
        #pwa-instructions-modal .step-text{font-size:13px;line-height:1.5;flex:1}
        #pwa-instructions-modal .step-ic{display:inline-block;padding:2px 8px;background:rgba(255,255,255,.2);border-radius:6px;font-weight:600;margin:0 2px}
        #pwa-instructions-modal .close-btn{width:100%;margin-top:14px;padding:12px;background:#fff;color:#1a2b5e;border:none;border-radius:11px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}
      </style>
      <div class="modal-card">
        <div class="modal-title">📲 ติดตั้ง OnaRoll</div>
        <div class="modal-sub">${ios ? 'สำหรับ iPhone/iPad (Safari)' : 'สำหรับ Android (Chrome)'}</div>
        ${ios ? `
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">แตะปุ่ม <span class="step-ic">⬆️ แชร์</span> ที่แถบด้านล่างของ Safari</div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">เลื่อนหา <span class="step-ic">➕ เพิ่มลงในหน้าจอหลัก</span></div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">แตะ <span class="step-ic">เพิ่ม</span> มุมขวาบน — ไอคอน OnaRoll จะปรากฏบนหน้าจอหลัก</div>
          </div>
        ` : `
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">แตะปุ่ม <span class="step-ic">⋮ 3 จุด</span> มุมขวาบนของ Chrome</div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">เลือก <span class="step-ic">เพิ่มในหน้าจอหลัก</span> หรือ <span class="step-ic">ติดตั้งแอป</span></div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">ยืนยัน — ไอคอน OnaRoll จะปรากฏบนหน้าจอหลัก</div>
          </div>
        `}
        <button class="close-btn" id="pwa-instr-close">เข้าใจแล้ว</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('pwa-instr-close').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── 8. IN-APP BROWSER WARNING ──────────────────────
  function showInAppBrowserWarning() {
    if (document.getElementById('pwa-iab-warning')) return;
    const w = document.createElement('div');
    w.id = 'pwa-iab-warning';
    w.innerHTML = `
      <style>
        #pwa-iab-warning{position:fixed;top:16px;left:16px;right:16px;max-width:420px;margin:0 auto;background:#f59e0b;color:#fff;border-radius:12px;padding:12px 14px;z-index:9998;box-shadow:0 6px 20px rgba(0,0,0,.25);font-family:'Kanit',-apple-system,sans-serif;font-size:12px;line-height:1.5}
        #pwa-iab-warning .iab-close{float:right;background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px}
      </style>
      <button class="iab-close" onclick="document.getElementById('pwa-iab-warning').remove()">×</button>
      <strong>⚠️ ติดตั้งแอปไม่ได้ในนี้</strong><br>
      กรุณาเปิดเว็บใน Chrome หรือ Safari แล้วลองอีกครั้ง<br>
      <small style="opacity:.85">(กดเมนู ⋮ → เปิดในเบราว์เซอร์)</small>
    `;
    document.body.appendChild(w);
    setTimeout(() => w.remove(), 12000);
  }

  // ── 9. UPDATE BANNER ──────────────────────────────
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

  // ── DEBUG HOOK ────────────────────────────────────
  window.OnaRollPWA = {
    triggerInstall,
    showInstall: showInstallButton,
    showInstructions: showInstallInstructions,
    isInstalled: isStandalone,
    isIOS,
    isInAppBrowser,
    clearDismiss: () => {
      localStorage.removeItem('pwa_dismissed_at');
      console.log('[PWA] Dismiss cleared');
    }
  };
})();
