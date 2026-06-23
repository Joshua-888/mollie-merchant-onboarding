const CVR_API_BASE = '/api/v1/cvr';

async function cvrRequest(path) {
  const response = await fetch(`${CVR_API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
      `CVR-opslag fejlede (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function initCvrLookup({
  organizationInput,
  cvrInput,
  suggestionsList,
  statusEl,
  onCompanyLoaded,
  onStatus,
}) {
  let activeRequest = 0;
  let suppressNameSearch = false;

  function setStatus(message, type = 'info') {
    if (!statusEl) return;
    if (!message) {
      statusEl.textContent = '';
      statusEl.className = 'cvr-status hidden';
      return;
    }
    statusEl.textContent = message;
    statusEl.className = `cvr-status cvr-status-${type}`;
    statusEl.classList.remove('hidden');
  }

  function hideSuggestions() {
    suggestionsList.innerHTML = '';
    suggestionsList.classList.add('hidden');
  }

  function showSuggestions(items) {
    if (!items.length) {
      hideSuggestions();
      return;
    }

    suggestionsList.innerHTML = items
      .map(
        (item) => `
        <button type="button" class="cvr-suggestion" data-cvr="${item.cvr}">
          <span class="cvr-suggestion-name">${escapeHtml(item.name)}</span>
          <span class="cvr-suggestion-meta">CVR ${item.cvr} · ${escapeHtml(item.addressLine)}</span>
        </button>`,
      )
      .join('');
    suggestionsList.classList.remove('hidden');
  }

  async function loadCompany(cvr, sourceLabel) {
    const requestId = ++activeRequest;
    setStatus(`Henter data fra CVR for ${cvr}…`, 'loading');
    onStatus?.('loading', cvr);

    try {
      const data = await cvrRequest(`/companies/${encodeURIComponent(cvr)}`);
      if (requestId !== activeRequest) return;

      suppressNameSearch = true;
      onCompanyLoaded(data.company);
      suppressNameSearch = false;

      setStatus(`Udfyldt fra CVR (${sourceLabel})`, 'success');
      onStatus?.('success', cvr);
      hideSuggestions();
    } catch (error) {
      if (requestId !== activeRequest) return;
      setStatus(error.message, 'error');
      onStatus?.('error', cvr);
    }
  }

  const fetchSuggestions = debounce(async (query) => {
    if (suppressNameSearch) return;

    const requestId = ++activeRequest;
    try {
      const data = await cvrRequest(`/suggestions?q=${encodeURIComponent(query)}`);
      if (requestId !== activeRequest) return;
      showSuggestions(data.suggestions ?? []);
    } catch (error) {
      if (requestId !== activeRequest) return;
      hideSuggestions();
      if (query.length >= 3) {
        setStatus(error.message, 'error');
      }
    }
  }, 320);

  organizationInput.addEventListener('input', () => {
    const query = organizationInput.value.trim();
    if (query.length < 2) {
      hideSuggestions();
      return;
    }
    fetchSuggestions(query);
  });

  organizationInput.addEventListener('focus', () => {
    const query = organizationInput.value.trim();
    if (query.length >= 2) fetchSuggestions(query);
  });

  cvrInput.addEventListener('input', () => {
    const digits = cvrInput.value.replace(/\D/g, '').slice(0, 8);
    if (digits !== cvrInput.value) {
      cvrInput.value = digits;
    }
    if (digits.length === 8) {
      loadCompany(digits, 'CVR-nummer');
    }
  });

  suggestionsList.addEventListener('click', (event) => {
    const button = event.target.closest('.cvr-suggestion');
    if (!button) return;
    loadCompany(button.dataset.cvr, button.querySelector('.cvr-suggestion-name')?.textContent ?? 'valgt virksomhed');
  });

  document.addEventListener('click', (event) => {
    if (
      !suggestionsList.contains(event.target) &&
      event.target !== organizationInput &&
      !organizationInput.contains(event.target)
    ) {
      hideSuggestions();
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
