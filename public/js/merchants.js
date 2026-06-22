import { apiRequest, showAlert, clearAlert } from './api.js';

const alertBox = document.getElementById('alert');
const merchantList = document.getElementById('merchant-list');
const merchantCount = document.getElementById('merchant-count');
const emptyState = document.getElementById('empty-state');
const syncAllBtn = document.getElementById('sync-all-btn');
const refreshBtn = document.getElementById('refresh-btn');

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('da-DK');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function statusSummary(merchant) {
  if (!merchant.connected) return 'Afventer godkendelse';
  if (merchant.mollieStatus === 'needs-data') return 'Mangler oplysninger';
  if (merchant.mollieStatus === 'in-review') return 'Under verificering';
  if (merchant.mollieStatus === 'completed') return 'Fuldført';
  return 'I gang';
}

function renderFlowStages(stages) {
  return `
    <ol class="flow-steps">
      ${stages
        .map(
          (stage) => `
        <li class="flow-step flow-step--${stage.state}" title="${escapeHtml(stage.description ?? '')}">
          <span class="flow-step-dot"></span>
          <span class="flow-step-label">${escapeHtml(stage.label)}</span>
        </li>`,
        )
        .join('')}
    </ol>`;
}

function renderMissingItems(merchant) {
  const capabilityReqs = merchant.capabilityRequirements ?? [];
  const genericItems = merchant.missingItems ?? [];

  if (!capabilityReqs.length && !genericItems.length) {
    return '<span class="badge badge-yes">Intet mangler</span>';
  }

  if (capabilityReqs.length) {
    return `
      <ul class="requirement-list">
        ${capabilityReqs
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
  }

  return genericItems
    .map((item) => `<span class="missing-chip">${escapeHtml(item)}</span>`)
    .join('');
}

function renderLocalKycSummary(merchant) {
  const summary = merchant.localKycSummary;
  if (!summary?.collected) return '';

  const pendingLabels = {
    identity: 'Identitet',
    ubo: 'UBO',
    bank: 'Bankkonto',
  };

  const pending = summary.pendingMollieConfirmation
    .map((key) => pendingLabels[key] ?? key)
    .join(', ');

  return `
    <div class="local-kyc-panel">
      <h4>Lokal KYC indsamlet</h4>
      <p class="local-kyc-meta">
        <span class="badge ${summary.validationPassed ? 'badge-yes' : 'badge-no'}">${summary.validationPassed ? 'Valideret' : 'Validering fejlede'}</span>
        <span class="badge ${summary.documentsUploaded ? 'badge-yes' : 'badge-no'}">${summary.documentsUploaded ? 'Dokument uploadet' : 'Mangler dokument'}</span>
      </p>
      <p class="local-kyc-note">Skal bekræftes hos Mollie: ${escapeHtml(pending || '—')}</p>
    </div>`;
}

function renderMerchantCard(merchant) {
  const name =
    merchant.organizationName ||
    `${merchant.givenName} ${merchant.familyName}`.trim() ||
    merchant.merchantId;

  return `
    <article class="merchant-card" data-merchant-id="${escapeHtml(merchant.merchantId)}">
      <div class="merchant-card-header">
        <div>
          <h3>${escapeHtml(name)}</h3>
          <p class="merchant-meta">${escapeHtml(merchant.email)} · ${escapeHtml(merchant.merchantId)}</p>
        </div>
        <div class="merchant-card-actions">
          <span class="badge badge-${merchant.mollieStatus ?? 'pending'}">${escapeHtml(statusSummary(merchant))}</span>
          <span class="progress-pill">${merchant.progressPercent}%</span>
        </div>
      </div>

      ${renderFlowStages(merchant.flowStages)}

      ${renderLocalKycSummary(merchant)}

      <div class="merchant-card-body">
        <div>
          <h4>Mangler</h4>
          <div class="missing-list">${renderMissingItems(merchant)}</div>
        </div>
        <div class="merchant-stats">
          <div><span>Oprettet</span><strong>${formatDate(merchant.createdAt)}</strong></div>
          <div><span>Godkendt</span><strong>${merchant.connected ? formatDate(merchant.connectedAt) : 'Nej'}</strong></div>
          <div><span>Betalinger</span><strong>${merchant.canReceivePayments ? 'Ja' : 'Nej'}</strong></div>
          <div><span>Udbetalinger</span><strong>${merchant.canReceiveSettlements ? 'Ja' : 'Nej'}</strong></div>
        </div>
      </div>

      ${merchant.statusMessage ? `<p class="status-note">${escapeHtml(merchant.statusMessage)}</p>` : ''}

      <div class="merchant-card-footer">
        <a class="btn btn-secondary" href="/dashboard.html?merchantId=${encodeURIComponent(merchant.merchantId)}">Åbn dashboard</a>
        ${
          merchant.dashboardUrl
            ? `<a class="btn btn-secondary" href="${escapeHtml(merchant.dashboardUrl)}" target="_blank" rel="noopener">Mollie dashboard</a>`
            : ''
        }
        <button type="button" class="btn btn-secondary sync-one" data-id="${escapeHtml(merchant.merchantId)}">Opdatér status</button>
      </div>
    </article>`;
}

async function loadMerchants(sync = false) {
  clearAlert(alertBox);
  syncAllBtn.disabled = true;
  refreshBtn.disabled = true;
  merchantList.innerHTML = '<p class="loading">Indlæser merchants…</p>';

  try {
    const path = sync ? '/merchants?sync=true' : '/merchants';
    const data = await apiRequest(path);
    const merchants = data.merchants ?? [];

    merchantCount.textContent = `${merchants.length} merchant${merchants.length === 1 ? '' : 's'}`;

    if (!merchants.length) {
      merchantList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    merchantList.innerHTML = merchants.map(renderMerchantCard).join('');

    merchantList.querySelectorAll('.sync-one').forEach((btn) => {
      btn.addEventListener('click', () => syncOne(btn.dataset.id));
    });
  } catch (error) {
    merchantList.innerHTML = '';
    showAlert(alertBox, error.message);
  } finally {
    syncAllBtn.disabled = false;
    refreshBtn.disabled = false;
  }
}

async function syncOne(merchantId) {
  try {
    await apiRequest(`/merchants/${encodeURIComponent(merchantId)}/sync`, { method: 'POST' });
    showAlert(alertBox, `Status opdateret for ${merchantId}.`, 'success');
    await loadMerchants(false);
  } catch (error) {
    showAlert(alertBox, error.message);
  }
}

syncAllBtn.addEventListener('click', () => loadMerchants(true));
refreshBtn.addEventListener('click', () => loadMerchants(false));

loadMerchants(false);
