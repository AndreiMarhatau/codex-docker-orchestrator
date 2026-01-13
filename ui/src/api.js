import { clearStoredPassword, emitAuthRequired, getStoredPassword } from './auth-storage.js';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

export function apiUrl(path, baseUrl = apiBaseUrl) {
  if (!baseUrl) {
    return path;
  }
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

export function apiUrlWithPassword(path) {
  if (typeof window === 'undefined') {
    return apiUrl(path);
  }
  const url = new URL(apiUrl(path), window.location.origin);
  const password = getStoredPassword();
  if (!password) {
    return url.toString();
  }
  url.searchParams.set('password', password);
  return url.toString();
}

export async function apiRequest(path, options = {}) {
  const password = getStoredPassword();
  const headers = {
    'Content-Type': 'application/json',
    ...(password ? { 'X-Orch-Password': password } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(apiUrl(path), {
    headers,
    ...options
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredPassword();
      emitAuthRequired();
    }
    const errorText = await response.text();
    const error = new Error(errorText || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
