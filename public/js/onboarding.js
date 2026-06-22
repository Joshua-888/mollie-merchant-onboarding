import { apiRequest, apiUploadForm, saveMerchantRecord, showAlert, clearAlert } from './api.js';
import { DK_COUNTRY, DK_LOCALE, DK_PAYMENT_METHODS } from './dk-config.js';

const form = document.getElementById('onboarding-form');
const alertBox = document.getElementById('alert');
const submitBtn = document.getElementById('submit-btn');
const methodsPreview = document.getElementById('methods-preview');
const legalEntitySelect = document.getElementById('legalEntity');
const emailInput = document.getElementById('email');
const profileEmailInput = document.getElementById('profileEmail');
const givenNameInput = document.getElementById('givenName');
const familyNameInput = document.getElementById('familyName');
const uboList = document.getElementById('ubo-list');
const addUboBtn = document.getElementById('add-ubo-btn');
const bankAccountHolderInput = document.getElementById('bankAccountHolder');
const organizationNameInput = document.getElementById('organizationName');

const FALLBACK_LEGAL_ENTITIES_FULL = [
  { value: 'dk-anpartsselskab', label: 'ApS (Anpartsselskab)' },
  { value: 'dk-aktieselskab', label: 'A/S (Aktieselskab)' },
  { value: 'dk-enkeltmandsvirksomhed', label: 'Enkeltmandsvirksomhed' },
  { value: 'dk-ivaerksaetterselskab', label: 'IVS (Iværksætterselskab)' },
  { value: 'dk-interessentskab', label: 'Interessentskab (I/S)' },
  { value: 'dk-kommanditselskab', label: 'Kommanditselskab (K/S)' },
];

let uboCounter = 0;

function generateMerchantId() {
  return `dk-merchant-${Date.now().toString(36)}`;
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? 'Sender til Mollie…' : 'Send til Mollie og start onboarding';
}

function renderLegalEntities(entities) {
  legalEntitySelect.innerHTML =
    '<option value="">Vælg selskabsform</option>' +
    entities.map((e) => `<option value="${e.value}">${e.label}</option>`).join('');
}

function renderMethodsPreview() {
  methodsPreview.innerHTML = DK_PAYMENT_METHODS.map(
    (method) =>
      `<span class="method-chip ${method.recommended ? 'recommended' : ''}" title="${method.description}">${method.label}${method.recommended ? ' ★' : ''}</span>`,
  ).join('');
}

async function loadLegalEntities() {
  try {
    const data = await apiRequest('/required-fields');
    if (data.legalEntities?.length) {
      renderLegalEntities(data.legalEntities);
      return;
    }
  } catch {
    // Use fallback
  }
  renderLegalEntities(FALLBACK_LEGAL_ENTITIES_FULL);
}

function createUboRow(initial = {}) {
  uboCounter += 1;
  const id = uboCounter;
  const row = document.createElement('div');
  row.className = 'ubo-row card nested-card';
  row.dataset.uboId = String(id);
  row.innerHTML = `
    <div class="ubo-row-header">
      <h3>UBO ${id}</h3>
      <button type="button" class="btn btn-secondary btn-sm remove-ubo" ${id === 1 ? 'disabled' : ''}>Fjern</button>
    </div>
    <div class="form-grid">
      <div>
        <label>Fornavn *</label>
        <input type="text" class="ubo-given-name" required value="${initial.givenName ?? ''}" />
      </div>
      <div>
        <label>Efternavn *</label>
        <input type="text" class="ubo-family-name" required value="${initial.familyName ?? ''}" />
      </div>
      <div>
        <label>Fødselsdato *</label>
        <input type="date" class="ubo-dob" required value="${initial.dateOfBirth ?? ''}" />
      </div>
      <div>
        <label>Nationalitet *</label>
        <input type="text" class="ubo-nationality" required maxlength="2" pattern="[A-Z]{2}" value="${initial.nationality ?? 'DK'}" />
      </div>
      <div>
        <label>Ejerandel (%) *</label>
        <input type="number" class="ubo-ownership" required min="0" max="100" step="0.01" value="${initial.ownershipPercent ?? 100}" />
      </div>
      <div>
        <label>Rolle</label>
        <input type="text" class="ubo-role" placeholder="Direktør" value="${initial.role ?? ''}" />
      </div>
      <div class="full-width ubo-pseudo-wrap">
        <label class="checkbox-label">
          <input type="checkbox" class="ubo-pseudo" ${initial.isPseudoUbo ? 'checked' : ''} />
          Pseudo-UBO (direktør/styrende person uden ≥25% ejerskab)
        </label>
      </div>
    </div>`;

  row.querySelector('.remove-ubo')?.addEventListener('click', () => {
    row.remove();
    renumberUboRows();
  });

  return row;
}

function renumberUboRows() {
  const rows = uboList.querySelectorAll('.ubo-row');
  rows.forEach((row, index) => {
    row.querySelector('h3').textContent = `UBO ${index + 1}`;
    const removeBtn = row.querySelector('.remove-ubo');
    if (removeBtn) removeBtn.disabled = rows.length === 1;
  });
}

function addUboRow(initial) {
  uboList.appendChild(createUboRow(initial));
  renumberUboRows();
}

function collectUbos() {
  return [...uboList.querySelectorAll('.ubo-row')].map((row) => ({
    givenName: row.querySelector('.ubo-given-name').value.trim(),
    familyName: row.querySelector('.ubo-family-name').value.trim(),
    dateOfBirth: row.querySelector('.ubo-dob').value,
    nationality: row.querySelector('.ubo-nationality').value.trim().toUpperCase(),
    ownershipPercent: Number(row.querySelector('.ubo-ownership').value),
    isPseudoUbo: row.querySelector('.ubo-pseudo').checked,
    role: row.querySelector('.ubo-role').value.trim() || undefined,
  }));
}

function syncOwnerToIdentity() {
  const dobField = document.getElementById('identityDateOfBirth');
  if (!dobField.value && document.querySelector('.ubo-dob')?.value) {
    dobField.value = document.querySelector('.ubo-dob').value;
  }
}

function syncSoleProprietorUbo() {
  if (legalEntitySelect.value !== 'dk-enkeltmandsvirksomhed') return;

  const firstRow = uboList.querySelector('.ubo-row');
  if (!firstRow) return;

  firstRow.querySelector('.ubo-given-name').value = givenNameInput.value;
  firstRow.querySelector('.ubo-family-name').value = familyNameInput.value;
  firstRow.querySelector('.ubo-ownership').value = '100';
  firstRow.querySelector('.ubo-pseudo').checked = false;
}

function syncBankHolderFromOrg() {
  if (!bankAccountHolderInput.value && organizationNameInput.value) {
    bankAccountHolderInput.value = organizationNameInput.value;
  }
}

emailInput.addEventListener('input', () => {
  if (!profileEmailInput.dataset.userEdited) {
    profileEmailInput.value = emailInput.value;
  }
});

profileEmailInput.addEventListener('input', () => {
  profileEmailInput.dataset.userEdited = profileEmailInput.value !== emailInput.value ? 'true' : '';
});

legalEntitySelect.addEventListener('change', syncSoleProprietorUbo);
givenNameInput.addEventListener('input', syncSoleProprietorUbo);
familyNameInput.addEventListener('input', syncSoleProprietorUbo);
organizationNameInput.addEventListener('input', syncBankHolderFromOrg);
addUboBtn.addEventListener('click', () => addUboRow());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert(alertBox);
  setLoading(true);

  syncSoleProprietorUbo();
  syncBankHolderFromOrg();

  const formData = new FormData(form);
  const merchantId = formData.get('merchantId')?.toString().trim() || generateMerchantId();
  const vatNumber = formData.get('vatNumber')?.toString().trim();
  const idFront = document.getElementById('idDocumentFront').files[0];
  const idBack = document.getElementById('idDocumentBack').files[0];

  const payload = {
    merchantId,
    email: formData.get('email'),
    givenName: formData.get('givenName'),
    familyName: formData.get('familyName'),
    locale: formData.get('locale') || DK_LOCALE,
    organizationName: formData.get('organizationName'),
    legalEntity: formData.get('legalEntity'),
    registrationNumber: formData.get('registrationNumber'),
    vatNumber: vatNumber || undefined,
    incorporationDate: formData.get('incorporationDate')?.toString() || undefined,
    address: {
      streetAndNumber: formData.get('streetAndNumber'),
      postalCode: formData.get('postalCode'),
      city: formData.get('city'),
      country: DK_COUNTRY,
    },
    website: formData.get('website'),
    phone: formData.get('phone'),
    profileEmail: formData.get('profileEmail') || formData.get('email'),
    businessDescription: formData.get('businessDescription')?.toString().trim() || undefined,
    localKyc: {
      identity: {
        documentType: formData.get('identityDocumentType'),
        documentNumber: formData.get('identityDocumentNumber'),
        issuingCountry: formData.get('identityIssuingCountry')?.toString().toUpperCase(),
        dateOfBirth: formData.get('identityDateOfBirth'),
        nationality: formData.get('identityNationality')?.toString().toUpperCase(),
        expiryDate: formData.get('identityExpiryDate'),
      },
      ubos: collectUbos(),
      bankAccount: {
        accountHolderName: formData.get('bankAccountHolder'),
        iban: formData.get('bankIban')?.toString().replace(/\s/g, ''),
        bic: formData.get('bankBic')?.toString().trim().toUpperCase() || undefined,
      },
    },
  };

  try {
    const result = await apiRequest('/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (idFront || idBack) {
      const uploadData = new FormData();
      if (idFront) uploadData.append('idDocumentFront', idFront);
      if (idBack) uploadData.append('idDocumentBack', idBack);
      await apiUploadForm(`/merchants/${encodeURIComponent(merchantId)}/kyc-documents`, uploadData);
    }

    saveMerchantRecord({
      merchantId,
      email: payload.email,
      organizationName: payload.organizationName,
      givenName: payload.givenName,
      familyName: payload.familyName,
      country: DK_COUNTRY,
      localKycCollected: true,
    });

    showAlert(
      alertBox,
      'Merchantdata og KYC gemt lokalt. Omdirigerer til Mollie for godkendelse…',
      'success',
    );

    setTimeout(() => {
      window.location.href = result.redirectUrl;
    }, 1200);
  } catch (error) {
    showAlert(alertBox, error.message);
    setLoading(false);
  }
});

document.getElementById('generate-id')?.addEventListener('click', () => {
  document.getElementById('merchantId').value = generateMerchantId();
});

if (!document.getElementById('merchantId').value) {
  document.getElementById('merchantId').placeholder = generateMerchantId();
}

renderMethodsPreview();
loadLegalEntities();
addUboRow({ nationality: 'DK', ownershipPercent: 100, role: 'Direktør' });
syncOwnerToIdentity();
