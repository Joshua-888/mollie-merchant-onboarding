import {
  formatIban,
  isValidBicFormat,
  isValidIbanChecksum,
  normalizeIban,
  suggestBicFromIban,
  validateBankAccount,
  validateBic,
  validateIban,
} from './bank-validation';

describe('bank-validation', () => {
  describe('validateIban', () => {
    it('accepts a valid Danish IBAN', () => {
      const result = validateIban('DK50 0040 0440 1162 43');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('DK5000400440116243');
      expect(result.bankCode).toBe('0040');
    });

    it('rejects invalid checksum', () => {
      const result = validateIban('DK5000400440116244');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects wrong Danish length', () => {
      const result = validateIban('DK50004004401162');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateBic', () => {
    it('accepts valid BIC format', () => {
      const result = validateBic('NDEADKKK', 'DK');
      expect(result?.valid).toBe(true);
      expect(result?.matchesIbanCountry).toBe(true);
    });

    it('rejects BIC with mismatched country', () => {
      const result = validateBic('DEUTDEFF', 'DK');
      expect(result?.valid).toBe(false);
    });
  });

  describe('suggestBicFromIban', () => {
    it('suggests Nordea BIC for bank code 0040', () => {
      expect(suggestBicFromIban('DK5000400440116243')).toBe('NDEADKKK');
    });
  });

  describe('validateBankAccount', () => {
    it('validates IBAN without BIC', () => {
      const result = validateBankAccount('DK5000400440116243');
      expect(result.valid).toBe(true);
      expect(result.suggestedBic).toBe('NDEADKKK');
    });
  });

  describe('formatIban', () => {
    it('groups IBAN in blocks of four', () => {
      expect(formatIban('DK5000400440116243')).toBe('DK50 0040 0440 1162 43');
    });
  });

  describe('isValidIbanChecksum', () => {
    it('matches validateIban for known good IBAN', () => {
      expect(isValidIbanChecksum('DK5000400440116243')).toBe(true);
    });
  });

  describe('isValidBicFormat', () => {
    it('accepts 8-char BIC', () => {
      expect(isValidBicFormat('NDEADKKK')).toBe(true);
    });
  });
});
