import { DENMARK_BANK_BIC_MAP, DENMARK_COUNTRY_CODE } from '../config/denmark.config';

const BIC_PATTERN = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const IBAN_PATTERN = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

export function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase();
}

export function normalizeBic(bic: string): string {
  return bic.replace(/\s/g, '').toUpperCase();
}

export function formatIban(iban: string): string {
  const normalized = normalizeIban(iban);
  return normalized.replace(/(.{4})/g, '$1 ').trim();
}

export function isValidIbanChecksum(iban: string): boolean {
  const normalized = normalizeIban(iban);
  if (!IBAN_PATTERN.test(normalized)) {
    return false;
  }

  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));

  let remainder = numeric;
  while (remainder.length > 2) {
    const block = remainder.slice(0, 9);
    remainder = String(parseInt(block, 10) % 97) + remainder.slice(block.length);
  }

  return parseInt(remainder, 10) % 97 === 1;
}

export function isValidBicFormat(bic: string): boolean {
  return BIC_PATTERN.test(normalizeBic(bic));
}

export function extractDanishBankCode(iban: string): string | undefined {
  const normalized = normalizeIban(iban);
  if (!normalized.startsWith('DK') || normalized.length !== 18) {
    return undefined;
  }
  return normalized.slice(4, 8);
}

export function suggestBicFromIban(iban: string): string | undefined {
  const bankCode = extractDanishBankCode(iban);
  if (!bankCode) return undefined;
  return DENMARK_BANK_BIC_MAP[bankCode];
}

export function bicCountryCode(bic: string): string | undefined {
  const normalized = normalizeBic(bic);
  return normalized.length >= 6 ? normalized.slice(4, 6) : undefined;
}

export interface IbanValidationResult {
  valid: boolean;
  normalized: string;
  formatted: string;
  countryCode?: string;
  bankCode?: string;
  errors: string[];
}

export interface BicValidationResult {
  valid: boolean;
  normalized?: string;
  bankName?: string;
  countryCode?: string;
  errors: string[];
  matchesIbanCountry?: boolean;
}

export interface BankAccountValidationResult {
  valid: boolean;
  iban: IbanValidationResult;
  bic?: BicValidationResult;
  suggestedBic?: string;
}

export function validateIban(iban: string): IbanValidationResult {
  const normalized = normalizeIban(iban);
  const errors: string[] = [];

  if (!normalized) {
    errors.push('IBAN er påkrævet');
    return { valid: false, normalized, formatted: '', errors };
  }

  if (!IBAN_PATTERN.test(normalized)) {
    errors.push('IBAN har ugyldigt format');
  }

  if (normalized.startsWith(DENMARK_COUNTRY_CODE) && normalized.length !== 18) {
    errors.push('Dansk IBAN skal være 18 tegn (DK + 16 cifre)');
  }

  if (errors.length === 0 && !isValidIbanChecksum(normalized)) {
    errors.push('IBAN kontrolciffer er ugyldigt');
  }

  return {
    valid: errors.length === 0,
    normalized,
    formatted: formatIban(normalized),
    countryCode: normalized.slice(0, 2),
    bankCode: extractDanishBankCode(normalized),
    errors,
  };
}

export function validateBic(bic: string | undefined, ibanCountryCode?: string): BicValidationResult | undefined {
  if (!bic?.trim()) {
    return undefined;
  }

  const normalized = normalizeBic(bic);
  const errors: string[] = [];

  if (!isValidBicFormat(normalized)) {
    errors.push('BIC/SWIFT skal være 8 eller 11 tegn (ISO 9362)');
  }

  const countryCode = bicCountryCode(normalized);
  const matchesIbanCountry = ibanCountryCode && countryCode ? countryCode === ibanCountryCode : undefined;

  if (matchesIbanCountry === false) {
    errors.push(`BIC landekode (${countryCode}) matcher ikke IBAN (${ibanCountryCode})`);
  }

  return {
    valid: errors.length === 0,
    normalized,
    countryCode,
    errors,
    matchesIbanCountry,
  };
}

export function validateBankAccount(iban: string, bic?: string): BankAccountValidationResult {
  const ibanResult = validateIban(iban);
  const bicResult = validateBic(bic, ibanResult.countryCode);
  const suggestedBic = ibanResult.valid ? suggestBicFromIban(ibanResult.normalized) : undefined;

  const valid = ibanResult.valid && (bicResult ? bicResult.valid : true);

  return {
    valid,
    iban: ibanResult,
    bic: bicResult,
    suggestedBic,
  };
}
