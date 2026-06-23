import { LocalKycDto } from './dto/kyc.dto';
import { isValidIbanChecksum, normalizeIban } from '../bank/bank-validation';
import { validateLocalKyc } from './kyc-validation';

describe('kyc-validation', () => {
  const validKyc: LocalKycDto = {
    identity: {
      documentType: 'passport',
      documentNumber: 'AB1234567',
      issuingCountry: 'DK',
      dateOfBirth: '1985-06-15',
      nationality: 'DK',
      expiryDate: '2030-01-01',
    },
    ubos: [
      {
        givenName: 'Lars',
        familyName: 'Nielsen',
        dateOfBirth: '1985-06-15',
        nationality: 'DK',
        ownershipPercent: 100,
        isPseudoUbo: false,
        role: 'Direktør',
      },
    ],
    bankAccount: {
      accountHolderName: 'Restaurant ApS',
      iban: 'DK5000400440116243',
    },
  };

  it('normalizes IBAN spacing', () => {
    expect(normalizeIban('dk50 0040 0440 1162 43')).toBe('DK5000400440116243');
  });

  it('validates a known Danish IBAN', () => {
    expect(isValidIbanChecksum('DK5000400440116243')).toBe(true);
  });

  it('accepts valid local KYC payload', () => {
    const result = validateLocalKyc(validKyc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects expired identity document', () => {
    const result = validateLocalKyc({
      ...validKyc,
      identity: { ...validKyc.identity, expiryDate: '2020-01-01' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Identitetsdokumentet er udløbet');
  });

  it('requires a major owner or pseudo-UBO', () => {
    const result = validateLocalKyc({
      ...validKyc,
      ubos: [
        {
          ...validKyc.ubos[0],
          ownershipPercent: 10,
          isPseudoUbo: false,
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('UBO'))).toBe(true);
  });

  it('rejects ownership above 100%', () => {
    const result = validateLocalKyc({
      ...validKyc,
      ubos: [
        { ...validKyc.ubos[0], ownershipPercent: 60 },
        { ...validKyc.ubos[0], givenName: 'Anna', ownershipPercent: 50 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('100%'))).toBe(true);
  });
});
