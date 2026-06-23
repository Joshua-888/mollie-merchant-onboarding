import {
  formatPhoneForMollie,
  formatStreetAddress,
  inferVatNumber,
  mapCompanyDto,
  mapLegalEntity,
  mapSuggestedOwner,
  mapSuggestedUbos,
  normalizePostalCode,
  parseIncorporationDate,
} from './cvr.mapper';

describe('cvr.mapper', () => {
  describe('mapLegalEntity', () => {
    it('maps ApS company code', () => {
      expect(mapLegalEntity(140, 'Anpartsselskab')).toBe('dk-anpartsselskab');
    });

    it('maps enkeltmandsvirksomhed', () => {
      expect(mapLegalEntity(10, 'Enkeltmandsvirksomhed')).toBe('dk-enkeltmandsvirksomhed');
    });
  });

  describe('parseIncorporationDate', () => {
    it('parses ISO dates', () => {
      expect(parseIncorporationDate('1989-01-09')).toBe('1989-01-09');
    });

    it('parses legacy CVR date format', () => {
      expect(parseIncorporationDate('28/11 - 1931')).toBe('1931-11-28');
    });
  });

  describe('formatStreetAddress', () => {
    it('builds address from structured details', () => {
      expect(
        formatStreetAddress('Fallback', {
          street: 'Nørregade',
          house_number: '10',
          floor: '2',
          door: 'th',
        }),
      ).toBe('Nørregade 10, 2. th');
    });
  });

  describe('formatPhoneForMollie', () => {
    it('formats Danish numbers for Mollie', () => {
      expect(formatPhoneForMollie('12345678')).toBe('+45 12 34 56 78');
    });
  });

  describe('inferVatNumber', () => {
    it('suggests VAT for ApS', () => {
      expect(inferVatNumber('12345678', 'dk-anpartsselskab')).toBe('DK12345678');
    });

    it('skips VAT for enkeltmandsvirksomhed by default', () => {
      expect(inferVatNumber('12345678', 'dk-enkeltmandsvirksomhed')).toBeUndefined();
    });
  });

  describe('mapSuggestedOwner', () => {
    it('uses addressco for enkeltmandsvirksomhed', () => {
      expect(
        mapSuggestedOwner(
          {
            name: 'RenKnud',
            addressco: 'Khaled El-Moussa',
            email: 'k.moussa2200@gmail.com',
            owners: [{ name: 'Khaled El-Moussa' }],
          },
          'dk-enkeltmandsvirksomhed',
        ),
      ).toEqual({
        givenName: 'Khaled',
        familyName: 'El-Moussa',
        email: 'k.moussa2200@gmail.com',
      });
    });
  });

  describe('mapSuggestedUbos', () => {
    it('marks director without major ownership as pseudo-UBO', () => {
      const ubos = mapSuggestedUbos(
        [
          {
            name: 'Lars Nielsen',
            role: 'DIREKTION',
            title: 'Direktør',
            share: 10,
            active: true,
          },
        ],
        'dk-anpartsselskab',
      );

      expect(ubos).toHaveLength(1);
      expect(ubos[0].isPseudoUbo).toBe(true);
      expect(ubos[0].ownershipPercent).toBe(0);
      expect(ubos[0].nationality).toBe('DK');
    });
  });

  describe('mapCompanyDto', () => {
    it('maps company fields for Mollie onboarding', () => {
      const summary = mapCompanyDto({
        vat: 12345678,
        name: 'Restaurant Sørensen ApS',
        address: 'Nørregade 10',
        zipcode: '2100',
        city: 'København',
        companycode: 140,
        companydesc: 'Anpartsselskab',
        startdate: '2015-03-12',
        phone: '12345678',
        email: 'betaling@restaurant.dk',
        website: 'restaurant.dk',
        owners: [
          {
            name: 'Lars Nielsen',
            role: 'DIREKTION',
            title: 'Direktør',
            share: 100,
            active: true,
          },
        ],
      });

      expect(summary.cvr).toBe('12345678');
      expect(summary.legalEntity).toBe('dk-anpartsselskab');
      expect(summary.vatNumber).toBe('DK12345678');
      expect(summary.incorporationDate).toBe('2015-03-12');
      expect(summary.address.postalCode).toBe('2100');
      expect(summary.phone).toBe('+45 12 34 56 78');
      expect(summary.website).toBe('https://restaurant.dk');
      expect(summary.email).toBe('betaling@restaurant.dk');
      expect(summary.suggestedOwner?.givenName).toBe('Lars');
      expect(summary.suggestedUbos).toHaveLength(1);
      expect(summary.bankAccountHolder).toBe('Restaurant Sørensen ApS');
    });

    it('normalizes postal code to 4 digits', () => {
      const summary = mapCompanyDto({
        vat: 1,
        name: 'Test',
        zipcode: '02100',
        city: 'København',
      });

      expect(summary.address.postalCode).toBe('2100');
    });
  });
});
