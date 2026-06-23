const BANK_API_BASE = '/api/v1/bank';

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function validateBank(iban, bic) {
  const params = new URLSearchParams({ iban });
  if (bic?.trim()) params.set('bic', bic.trim());

  const response = await fetch(`${BANK_API_BASE}/validate?${params}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
      `Bankvalidering fejlede (${response.status})`;
    throw new Error(message);
  }

  return data.validation;
}

function formatValidationMessage(validation) {
  const parts = [];

  if (validation.iban.valid) {
    parts.push(`IBAN gyldig${validation.iban.countryName ? ` (${validation.iban.countryName})` : ''}`);
    if (validation.iban.formatted) {
      parts.push(validation.iban.formatted);
    }
  } else if (validation.iban.errors?.length) {
    parts.push(validation.iban.errors.join('. '));
  }

  if (validation.bic) {
    if (validation.bic.valid) {
      parts.push(
        `BIC gyldig${validation.bic.bankName ? `: ${validation.bic.bankName}` : ''}`,
      );
    } else if (validation.bic.errors?.length) {
      parts.push(validation.bic.errors.join('. '));
    }
  }

  if (validation.suggestedBic && !validation.bic?.normalized) {
    parts.push(`Foreslået BIC: ${validation.suggestedBic}`);
  }

  return parts.join(' · ');
}

export function initBankValidation({ ibanInput, bicInput, statusEl }) {
  let activeRequest = 0;
  let bicTouched = false;

  function setStatus(message, type = 'info') {
    if (!statusEl) return;
    if (!message) {
      statusEl.textContent = '';
      statusEl.className = 'bank-status hidden';
      return;
    }
    statusEl.textContent = message;
    statusEl.className = `bank-status bank-status-${type} cvr-status cvr-status-${type}`;
    statusEl.classList.remove('hidden');
  }

  function setInputState(input, valid) {
    if (!input) return;
    input.classList.remove('input-valid', 'input-invalid');
    if (valid === true) input.classList.add('input-valid');
    if (valid === false) input.classList.add('input-invalid');
  }

  async function runValidation() {
    const iban = ibanInput.value.trim();
    const bic = bicInput.value.trim();

    if (iban.replace(/\s/g, '').length < 8) {
      setStatus('');
      setInputState(ibanInput, null);
      setInputState(bicInput, null);
      return;
    }

    const requestId = ++activeRequest;
    setStatus('Validerer IBAN…', 'loading');

    try {
      const validation = await validateBank(iban, bic);
      if (requestId !== activeRequest) return;

      if (validation.iban.valid && validation.iban.formatted) {
        ibanInput.value = validation.iban.formatted;
      }

      if (!bicTouched && validation.suggestedBic && !bic) {
        bicInput.value = validation.suggestedBic;
      }

      setInputState(ibanInput, validation.iban.valid);
      setInputState(bicInput, validation.bic ? validation.bic.valid : null);

      const type = validation.valid ? 'success' : 'error';
      setStatus(formatValidationMessage(validation), type);
    } catch (error) {
      if (requestId !== activeRequest) return;
      setStatus(error.message, 'error');
      setInputState(ibanInput, false);
    }
  }

  const debouncedValidate = debounce(runValidation, 450);

  ibanInput.addEventListener('input', debouncedValidate);
  bicInput.addEventListener('input', () => {
    bicTouched = true;
    debouncedValidate();
  });

  ibanInput.addEventListener('blur', runValidation);
  bicInput.addEventListener('blur', runValidation);
}
