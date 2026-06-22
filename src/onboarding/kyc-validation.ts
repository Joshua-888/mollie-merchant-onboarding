import { LocalKycDto, UboPersonDto } from './dto/kyc.dto';

export interface KycValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const MIN_AGE_YEARS = 18;
const UBO_THRESHOLD_PERCENT = 25;

export function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase();
}

export function isValidIban(iban: string): boolean {
  const normalized = normalizeIban(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized)) {
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

function ageInYears(dateOfBirth: string, referenceDate = new Date()): number {
  const birth = new Date(dateOfBirth);
  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function validateMinimumAge(dateOfBirth: string, label: string, errors: string[]): void {
  if (ageInYears(dateOfBirth) < MIN_AGE_YEARS) {
    errors.push(`${label} skal være mindst ${MIN_AGE_YEARS} år`);
  }
}

function validateUboStructure(ubos: UboPersonDto[], errors: string[], warnings: string[]): void {
  const totalOwnership = ubos.reduce((sum, ubo) => sum + ubo.ownershipPercent, 0);

  if (totalOwnership > 100) {
    errors.push(`Samlet ejerandel (${totalOwnership}%) må ikke overstige 100%`);
  }

  const hasMajorOwner = ubos.some((ubo) => ubo.ownershipPercent >= UBO_THRESHOLD_PERCENT);
  const hasPseudoUbo = ubos.some((ubo) => ubo.isPseudoUbo);

  if (!hasMajorOwner && !hasPseudoUbo) {
    errors.push(
      `Mindst én UBO skal have ≥${UBO_THRESHOLD_PERCENT}% ejerskab, eller angiv en pseudo-UBO (direktør uden ≥${UBO_THRESHOLD_PERCENT}% ejerskab)`,
    );
  }

  ubos.forEach((ubo, index) => {
    validateMinimumAge(ubo.dateOfBirth, `UBO ${index + 1}`, errors);

    if (ubo.ownershipPercent >= UBO_THRESHOLD_PERCENT && ubo.isPseudoUbo) {
      warnings.push(
        `UBO ${index + 1} har ≥${UBO_THRESHOLD_PERCENT}% ejerskab — pseudo-UBO markering er normalt ikke nødvendig`,
      );
    }
  });
}

export function validateLocalKyc(
  localKyc: LocalKycDto,
  context?: { legalEntity?: string },
): KycValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  validateMinimumAge(localKyc.identity.dateOfBirth, 'Identitetsindehaver', errors);

  const expiry = new Date(localKyc.identity.expiryDate);
  if (expiry <= new Date()) {
    errors.push('Identitetsdokumentet er udløbet');
  }

  const iban = normalizeIban(localKyc.bankAccount.iban);
  if (!isValidIban(iban)) {
    errors.push('IBAN er ugyldigt (kontroller nummer og format)');
  }

  if (iban.startsWith('DK') && iban.length !== 18) {
    errors.push('Dansk IBAN skal være 18 tegn (DK + 16 cifre)');
  }

  validateUboStructure(localKyc.ubos, errors, warnings);

  if (context?.legalEntity === 'dk-enkeltmandsvirksomhed') {
    if (localKyc.ubos.length !== 1) {
      warnings.push('Enkeltmandsvirksomhed bør typisk have én UBO (ejeren) med 100% ejerskab');
    } else if (localKyc.ubos[0].ownershipPercent !== 100) {
      warnings.push('Enkeltmandsvirksomhed bør typisk have 100% ejerskab hos ejeren');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface LocalKycSummary {
  collected: boolean;
  validationPassed: boolean;
  documentsUploaded: boolean;
  pendingMollieConfirmation: Array<'identity' | 'ubo' | 'bank'>;
  validationWarnings: string[];
}

export function buildLocalKycSummary(
  localKyc?: MerchantLocalKycSnapshot,
): LocalKycSummary | undefined {
  if (!localKyc) {
    return undefined;
  }

  const pending: LocalKycSummary['pendingMollieConfirmation'] = [];
  if (localKyc.identity) pending.push('identity');
  if (localKyc.ubos?.length) pending.push('ubo');
  if (localKyc.bankAccount) pending.push('bank');

  return {
    collected: true,
    validationPassed: localKyc.validationPassed,
    documentsUploaded: localKyc.documentsUploaded,
    pendingMollieConfirmation: pending,
    validationWarnings: localKyc.validationWarnings,
  };
}

export interface MerchantLocalKycSnapshot {
  identity: LocalKycDto['identity'];
  ubos: LocalKycDto['ubos'];
  bankAccount: LocalKycDto['bankAccount'];
  validationPassed: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  documentsUploaded: boolean;
  documentFiles?: { front?: string; back?: string };
  collectedAt: Date;
}
