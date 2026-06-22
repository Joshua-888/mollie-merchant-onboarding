const API_BASE = '/api/v1/onboarding';

const MERCHANTS_KEY = 'takeawayhero_merchants';

export function saveMerchantRecord(merchant) {
  const list = getMerchantRecords();
  const existing = list.findIndex((m) => m.merchantId === merchant.merchantId);
  const entry = { ...merchant, updatedAt: new Date().toISOString() };
  if (existing >= 0) {
    list[existing] = entry;
  } else {
    list.unshift(entry);
  }
  localStorage.setItem(MERCHANTS_KEY, JSON.stringify(list.slice(0, 20)));
}

export function getMerchantRecords() {
  try {
    return JSON.parse(localStorage.getItem(MERCHANTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
      data.detail ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function apiUploadForm(path, formData) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.detail || `Upload failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export function showAlert(container, message, type = 'error') {
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  container.classList.remove('hidden');
}

export function clearAlert(container) {
  container.innerHTML = '';
  container.classList.add('hidden');
}
