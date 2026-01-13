const STORAGE_KEY = 'orchestrator-ui-password';
const COOKIE_NAME = 'orch_ui_pw';
const AUTH_EVENT = 'orch-auth-required';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10;

function setCookie(password) {
  if (typeof document === 'undefined') {
    return;
  }
  const encoded = encodeURIComponent(password);
  document.cookie = `${COOKIE_NAME}=${encoded}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function clearCookie() {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function getStoredPassword() {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch (err) {
    return '';
  }
}

function setStoredPassword(password) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, password);
  } catch (err) {
    return;
  }
  setCookie(password);
}

function clearStoredPassword() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    return;
  }
  clearCookie();
}

function emitAuthRequired() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

function onAuthRequired(handler) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

export {
  clearStoredPassword,
  emitAuthRequired,
  getStoredPassword,
  onAuthRequired,
  setStoredPassword
};
