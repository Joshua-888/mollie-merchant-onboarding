import { apiRequest, getMerchantRecords, showAlert, clearAlert } from './api.js';
import { DK_PAYMENT_METHODS } from './dk-config.js';

const alertBox = document.getElementById('alert');
const merchantInput = document.getElementById('merchant-id-input');
const loadBtn = document.getElementById('load-btn');
const statusSection = document.getElementById('status-section');
const localKycSection = document.getElementById('local-kyc-section');
const profilesSection = document.getElementById('profiles-section');
const profileFormSection = document.getElementById('profile-form-section');
const recentList = document.getElementById('recent-merchants');
const availableMethods = document.getElementById('available-methods');

let currentMerchantId = null;
let paymentMethods = DK_PAYMENT_METHODS;

function statusBadgeClass(status) {
  return `badge badge-${status}`;
}

function statusLabel(value) {
  return value ? 'Ja' : 'Nej';
}

function renderAvailableMethods() {
  availableMethods.innerHTML = paymentMethods
    .map(
      (method) =>
        `<span class="method-chip ${method.recommended ? 'recommended' : ''}" title="${method.description}">${method.label}${method.recommended ? ' ★' : ''}</span>`,
    )
    .join('');
}

async function loadPaymentMethodCatalog() {
  try {
    const data = await apiRequest('/payment-methods');
    if (data.methods?.length) {
      paymentMethods = data.methods;
    }
  } catch {
    paymentMethods = DK_PAYMENT_METHODS;
  }
  renderAvailableMethods();
}

function renderRecentMerchants() {
  const merchants = getMerchantRecords();
  recentList.innerHTML = merchants.length
    ? merchants
        .map(
          (m) =>
            `<button type="button" data-id="${m.merchantId}" title="${m.email || ''}">${m.organizationName || m.merchantId}</button>`,
        )
        .join('')
    : '<span class="loading">Ingen seneste merchants — start onboarding først.</span>';

  recentList.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      merchantInput.value = btn.dataset.id;
      loadDashboard(btn.dataset.id);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function maskIban(iban) {
  if (!iban || iban.length < 8) return '—';
  return `${iban.slice(0, 4)} **** **** ${iban.slice(-4)}`;
}

function documentTypeLabel(type) {
  const labels = {
    passport: 'Pas',
    national_id: 'Nationalt ID',
    drivers_license: 'Kørekort',
  };
  return labels[type] ?? type;
}

function renderLocalKyc(merchant) {
  const container = document.getElementById('local-kyc-content');
  const kyc = merchant?.localKyc;
  const summary = merchant?.localKycSummary;

  if (!kyc) {
    localKycSection.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  const uboRows = (kyc.ubos ?? [])
    .map(
      (ubo) =>
        `<li>${escapeHtml(`${ubo.givenName} ${ubo.familyName}`)} — ${ubo.ownershipPercent}%${ubo.isPseudoUbo ? ' (pseudo-UBO)' : ''}</li>`,
    )
    .join('');

  container.innerHTML = `
    <div class="local-kyc-meta" style="margin-bottom: 1rem">
      <span class="badge ${summary?.validationPassed ? 'badge-yes' : 'badge-no'}">${summary?.validationPassed ? 'Valideret' : 'Validering fejlede'}</span>
      <span class="badge ${summary?.documentsUploaded ? 'badge-yes' : 'badge-no'}">${summary?.documentsUploaded ? 'Dokument uploadet' : 'Mangler dokument'}</span>
    </div>
    <div class="status-grid">
      <div class="stat">
        <div class="stat-label">Identitet</div>
        <div class="stat-value">${escapeHtml(documentTypeLabel(kyc.identity.documentType))} · ${escapeHtml(kyc.identity.documentNumber)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Bankkonto</div>
        <div class="stat-value">${escapeHtml(kyc.bankAccount.accountHolderName)}<br /><code>${escapeHtml(maskIban(kyc.bankAccount.iban))}</code></div>
      </div>
    </div>
    <h3 style="font-size: 0.9rem; margin: 1rem 0 0.5rem">UBO'er</h3>
    <ul class="info-list compact">${uboRows || '<li>Ingen UBO registreret</li>'}</ul>
    ${
      summary?.validationWarnings?.length
        ? `<p class="local-kyc-note">Advarsler: ${escapeHtml(summary.validationWarnings.join('; '))}</p>`
        : ''
    }`;

  localKycSection.classList.remove('hidden');
}

function renderRequirements(requirements) {
  const section = document.getElementById('requirements-section');
  const list = document.getElementById('requirements-list');

  if (!requirements?.length) {
    section.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  list.innerHTML = `
    <ul class="requirement-list">
      ${requirements
        .map(
          (req) => `
        <li class="requirement-item">
          <div class="requirement-item-header">
            <span class="requirement-label">${escapeHtml(req.label)}</span>
            <span class="requirement-status requirement-status--${escapeHtml(req.status)}">${escapeHtml(req.status)}</span>
          </div>
          ${
            req.dashboardUrl
              ? `<a class="requirement-link" href="${escapeHtml(req.dashboardUrl)}" target="_blank" rel="noopener">Løs hos Mollie →</a>`
              : ''
          }
        </li>`,
        )
        .join('')}
    </ul>`;
  section.classList.remove('hidden');
}

function renderStatus(data) {
  document.getElementById('org-name').textContent = data.organizationName || '—';
  document.getElementById('status-badge').textContent = data.status;
  document.getElementById('status-badge').className = statusBadgeClass(data.status);
  document.getElementById('payments-badge').textContent = statusLabel(data.canReceivePayments);
  document.getElementById('payments-badge').className = `badge ${data.canReceivePayments ? 'badge-yes' : 'badge-no'}`;
  document.getElementById('settlements-badge').textContent = statusLabel(data.canReceiveSettlements);
  document.getElementById('settlements-badge').className = `badge ${data.canReceiveSettlements ? 'badge-yes' : 'badge-no'}`;
  document.getElementById('status-message').textContent = data.message;

  const dashboardLink = document.getElementById('mollie-dashboard-link');
  if (data.dashboardUrl) {
    dashboardLink.href = data.dashboardUrl;
    dashboardLink.classList.remove('hidden');
  } else {
    dashboardLink.classList.add('hidden');
  }

  statusSection.classList.remove('hidden');
}

function renderProfiles(profiles) {
  const list = document.getElementById('profile-list');

  if (!profiles.length) {
    list.innerHTML = '<p class="loading">Ingen betalingsprofiler endnu. Opret en nedenfor.</p>';
  } else {
    list.innerHTML = profiles
      .map(
        (p) => `
      <li class="profile-item" data-profile-id="${p.profileId}">
        <div>
          <strong>${p.name}</strong>
          <div class="profile-meta">${p.website} · ${p.status} · ${p.mode}</div>
          <div class="method-chips" id="methods-${p.profileId}"></div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm load-methods" data-profile-id="${p.profileId}">Vis metoder</button>
      </li>`,
      )
      .join('');

    list.querySelectorAll('.load-methods').forEach((btn) => {
      btn.addEventListener('click', () => loadPaymentMethods(btn.dataset.profileId));
    });
  }

  profilesSection.classList.remove('hidden');
  profileFormSection.classList.remove('hidden');
}

async function loadPaymentMethods(profileId) {
  const container = document.getElementById(`methods-${profileId}`);
  container.innerHTML = '<span class="loading">Indlæser…</span>';

  try {
    const data = await apiRequest(`/profiles/${profileId}/methods?merchantId=${encodeURIComponent(currentMerchantId)}`);
    const enabled = new Set((data.methods || []).map((m) => m.id));

    container.innerHTML = paymentMethods
      .map((method) => {
        const isEnabled = enabled.has(method.id);
        return `<button type="button" class="method-chip ${isEnabled ? 'enabled' : ''} ${method.recommended ? 'recommended' : ''}" data-profile-id="${profileId}" data-method-id="${method.id}" title="${method.description}" ${isEnabled ? 'disabled' : ''}>${method.label}${isEnabled ? ' ✓' : ''}</button>`;
      })
      .join('');

    container.querySelectorAll('.method-chip:not(.enabled)').forEach((chip) => {
      chip.addEventListener('click', () => enableMethod(chip.dataset.profileId, chip.dataset.methodId, chip));
    });
  } catch (error) {
    container.innerHTML = `<span class="loading">${error.message}</span>`;
  }
}

async function enableMethod(profileId, methodId, chip) {
  const originalLabel = chip.textContent;
  chip.textContent = 'Aktiverer…';
  chip.disabled = true;

  try {
    await apiRequest(`/profiles/${profileId}/methods/${methodId}?merchantId=${encodeURIComponent(currentMerchantId)}`, {
      method: 'POST',
    });
    await loadPaymentMethods(profileId);
  } catch (error) {
    chip.textContent = originalLabel;
    chip.disabled = false;
    showAlert(alertBox, error.message);
  }
}

async function loadDashboard(merchantId) {
  if (!merchantId) {
    showAlert(alertBox, 'Indtast et merchant-ID for at indlæse dashboardet.');
    return;
  }

  clearAlert(alertBox);
  currentMerchantId = merchantId;
  statusSection.classList.add('hidden');
  localKycSection.classList.add('hidden');
  profilesSection.classList.add('hidden');
  loadBtn.disabled = true;
  loadBtn.textContent = 'Indlæser…';

  try {
    try {
      const merchantData = await apiRequest(`/merchants/${encodeURIComponent(merchantId)}`);
      renderLocalKyc(merchantData.merchant);
    } catch {
      renderLocalKyc(null);
    }

    const status = await apiRequest(`/status/${encodeURIComponent(merchantId)}`);
    renderStatus(status);

    try {
      const capabilities = await apiRequest(`/capabilities/${encodeURIComponent(merchantId)}`);
      renderRequirements(capabilities.requirements ?? []);
    } catch {
      renderRequirements([]);
    }

    try {
      const profileData = await apiRequest(`/profiles/${encodeURIComponent(merchantId)}`);
      renderProfiles(profileData.profiles || []);
    } catch {
      renderProfiles([]);
      showAlert(
        alertBox,
        'Onboarding-status indlæst. Forbind merchanten via Mollie først for at administrere profiler.',
        'info',
      );
    }
  } catch (error) {
    showAlert(alertBox, error.message);
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = 'Indlæs dashboard';
  }
}

loadBtn.addEventListener('click', () => loadDashboard(merchantInput.value.trim()));

document.getElementById('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentMerchantId) return;

  const formData = new FormData(event.target);
  const payload = {
    merchantId: currentMerchantId,
    name: formData.get('name'),
    website: formData.get('website'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
  };

  try {
    await apiRequest('/profiles', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    clearAlert(alertBox);
    showAlert(alertBox, 'Betalingsprofil oprettet.', 'success');
    const profileData = await apiRequest(`/profiles/${encodeURIComponent(currentMerchantId)}`);
    renderProfiles(profileData.profiles || []);
  } catch (error) {
    showAlert(alertBox, error.message);
  }
});

document.getElementById('refresh-btn')?.addEventListener('click', () => {
  if (currentMerchantId) loadDashboard(currentMerchantId);
});

const params = new URLSearchParams(window.location.search);

if (params.get('connected') === 'true') {
  showAlert(alertBox, 'Merchant er nu forbundet til Mollie!', 'success');
}

if (params.get('error')) {
  showAlert(alertBox, params.get('errorDescription') || params.get('error'), 'error');
}

if (params.get('merchantId')) {
  merchantInput.value = params.get('merchantId');
  loadDashboard(params.get('merchantId'));
}

loadPaymentMethodCatalog();
renderRecentMerchants();
