import { useAuth } from '../composables/useAuth';

let authComposable = null;

export function setAuthComposable(composable) {
  authComposable = composable;
}

export async function apiRequest(path, options = {}) {
  const auth = authComposable || useAuth();
  const { getApiUrl, getAuthHeaders } = auth;

  const url = getApiUrl(path);
  const headers = getAuthHeaders();
  if (options.body != null && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const contentType = res.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!res.ok) {
    const errData = isJson ? await res.json().catch(() => ({})) : {};
    throw new Error(errData.message || `Request failed: ${res.status}`);
  }

  return isJson ? res.json() : res.text();
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body) =>
    apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) =>
    apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) =>
    apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};
