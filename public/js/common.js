// Common utilities used across all frontend pages

/**
 * True when this page is running inside the Creoveya desktop app
 * (Electron), not a regular browser tab. The desktop app tags its
 * requests with a custom User-Agent fragment (see desktop-app/main.js).
 * Runs immediately (not on DOMContentLoaded) and tags <html> right away
 * so CSS can key off it before first paint — avoids a flash of the
 * website-style chrome before switching to the desktop-app look.
 */
function isDesktopApp() {
  return typeof navigator !== 'undefined' && /CreoveyaDesktopApp/.test(navigator.userAgent);
}
if (isDesktopApp()) {
  document.documentElement.classList.add('desktop-app');
}

/**
 * Make an API fetch request with automatic JSON serialization
 * @param {string} url - API endpoint
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise} JSON response from the API
 */
async function apiFetch(url, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    credentials: 'include',
  };

  if (options.body instanceof FormData) {
    fetchOptions.body = options.body;
  } else {
    fetchOptions.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.body !== undefined && options.body !== null) {
      fetchOptions.body = JSON.stringify(options.body);
    }
  }

  const res = await fetch(url, fetchOptions);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

/**
 * Get the current user's session/profile
 * @returns {Promise} User object or null if not logged in
 */
async function getSession() {
  try {
    const data = await apiFetch('/api/me');
    return data.user;
  } catch (err) {
    return null;
  }
}

// Utility to format seconds into a readable time format
function formatMinutes(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Cookie consent — runs on every page (this file is loaded everywhere).
// Only two real categories exist today: "essential" (the signed session
// cookie that keeps you logged in — always on, can't be disabled) and
// "functional" (small local-storage conveniences, e.g. remembering this
// consent choice itself, sidebar/nav state, etc). Nothing here is
// third-party advertising or analytics tracking.
// ---------------------------------------------------------------------------
const COOKIE_CONSENT_KEY = 'creoveya_cookie_consent_v2';

function getCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCookieConsent(functionalEnabled) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
    essential: true,
    functional: Boolean(functionalEnabled),
    decidedAt: new Date().toISOString(),
  }));
}

function initCookieConsent() {
  // Cookies/local-storage consent is a web-browser concept — showing this
  // banner inside the native desktop app doesn't make sense and reads as
  // unpolished, so it's skipped entirely there.
  if (isDesktopApp()) return;

  renderCookieBanner();

  // Any element on the page with data-cookie-settings re-opens the
  // preferences modal at any time (e.g. a "Cookie Settings" footer link).
  document.querySelectorAll('[data-cookie-settings]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openCookiePreferencesModal();
    });
  });
}

function renderCookieBanner() {
  if (getCookieConsent()) return; // Already decided — don't show again.
  if (document.getElementById('cookieConsentBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'cookieConsentBanner';
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML = `
    <div class="cookie-banner-icon">🍪</div>
    <div class="cookie-banner-body">
      <strong>We value your privacy</strong>
      <p>
        Creoveya uses a signed session cookie to keep you logged in, and a small
        local preference to remember this choice. We don't use third-party
        advertising or tracking cookies. See our
        <a href="/pages/cookies.html">Cookie Policy</a> for details.
      </p>
    </div>
    <div class="cookie-banner-actions">
      <button class="btn btn-outline btn-sm" id="cookieManageBtn" type="button">Manage Preferences</button>
      <button class="btn btn-outline btn-sm" id="cookieRejectBtn" type="button">Reject Non-Essential</button>
      <button class="btn btn-primary btn-sm" id="cookieAcceptBtn" type="button">Accept All</button>
    </div>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('cookie-banner-visible'));

  document.getElementById('cookieAcceptBtn').addEventListener('click', () => {
    setCookieConsent(true);
    dismissCookieBanner();
  });
  document.getElementById('cookieRejectBtn').addEventListener('click', () => {
    setCookieConsent(false);
    dismissCookieBanner();
  });
  document.getElementById('cookieManageBtn').addEventListener('click', () => {
    openCookiePreferencesModal();
  });
}

function dismissCookieBanner() {
  const banner = document.getElementById('cookieConsentBanner');
  if (!banner) return;
  banner.classList.remove('cookie-banner-visible');
  setTimeout(() => banner.remove(), 250);
}

function openCookiePreferencesModal() {
  const existing = getCookieConsent();
  const functionalOn = existing ? existing.functional : true;

  let backdrop = document.getElementById('cookiePrefsBackdrop');
  if (backdrop) backdrop.remove();

  backdrop = document.createElement('div');
  backdrop.id = 'cookiePrefsBackdrop';
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 style="margin:0;">Cookie Preferences</h3>
        <button class="modal-close" id="cookiePrefsClose" type="button">×</button>
      </div>
      <div class="cookie-pref-row">
        <div>
          <strong>Essential</strong>
          <p class="text-muted" style="margin:2px 0 0; font-size:.85rem;">Keeps you signed in and secures your session. Always on.</p>
        </div>
        <label class="cookie-toggle cookie-toggle-locked">
          <input type="checkbox" checked disabled>
          <span></span>
        </label>
      </div>
      <div class="cookie-pref-row">
        <div>
          <strong>Functional</strong>
          <p class="text-muted" style="margin:2px 0 0; font-size:.85rem;">Remembers small preferences, like this consent choice itself.</p>
        </div>
        <label class="cookie-toggle">
          <input type="checkbox" id="cookieFunctionalToggle" ${functionalOn ? 'checked' : ''}>
          <span></span>
        </label>
      </div>
      <button class="btn btn-primary btn-block mt-16" id="cookiePrefsSave" type="button">Save Preferences</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  document.getElementById('cookiePrefsClose').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.getElementById('cookiePrefsSave').addEventListener('click', () => {
    setCookieConsent(document.getElementById('cookieFunctionalToggle').checked);
    close();
    dismissCookieBanner();
  });
}

document.addEventListener('DOMContentLoaded', initCookieConsent);

/**
 * Wires up the profile menu dropdown used in the dashboard/studio topbar
 * (see sidebar.js's renderUserChrome). Toggles open on click, closes when
 * clicking anywhere outside it. Safe to call even if the expected
 * elements aren't present on a given page.
 */
function initProfileMenu(user) {
  const btn = document.getElementById('profileBtn');
  const dropdown = document.getElementById('profileDropdown');
  const initial = document.getElementById('profileInitial');
  const name = document.getElementById('profileName');
  if (!btn || !dropdown) return;

  if (user) {
    if (initial) initial.textContent = (user.username || '?').charAt(0).toUpperCase();
    if (name) name.textContent = user.username || '';
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.classList.contains('open')) return;
    if (dropdown.contains(e.target) || btn.contains(e.target)) return;
    dropdown.classList.remove('open');
  });
}
