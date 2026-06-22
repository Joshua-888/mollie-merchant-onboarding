import {
  buildFlowStages,
  computeMissingItems,
  computeMissingSubmissionFields,
  computeProgressPercent,
  MerchantRecord,
  toListItem,
} from './merchant-flow';

describe('merchant-flow', () => {
  const baseRecord: MerchantRecord = {
    merchantId: 'dk-1',
    email: 'ejer@restaurant.dk',
    givenName: 'Lars',
    familyName: 'Nielsen',
    organizationName: 'Restaurant ApS',
    legalEntity: 'dk-anpartsselskab',
    address: {
      streetAndNumber: 'Nørregade 10',
      postalCode: '2100',
      city: 'København',
      country: 'DK',
    },
    registrationNumber: '12345678',
    vatNumber: 'DK12345678',
    website: 'https://restaurant.dk',
    phone: '+4512345678',
    profileEmail: 'betaling@restaurant.dk',
    clientLinkId: 'cl_123',
    connected: false,
    profileCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('detects missing submission fields', () => {
    const missing = computeMissingSubmissionFields({
      ...baseRecord,
      phone: '',
    });

    expect(missing).toContain('Telefon');
  });

  it('flags authorization as missing when not connected', () => {
    const item = toListItem(baseRecord);
    expect(item.missingItems).toContain('Merchant skal godkende via Mollie-link');
  });

  it('flags Mollie KYC when needs-data without capabilities', () => {
    const item = toListItem({
      ...baseRecord,
      connected: true,
      mollieStatus: 'needs-data',
    });

    expect(item.missingItems).toContain('Mollie kræver yderligere KYC-oplysninger');
  });

  it('uses capability requirements when available', () => {
    const item = toListItem({
      ...baseRecord,
      connected: true,
      mollieStatus: 'needs-data',
      capabilityRequirements: [
        {
          capability: 'settlements',
          capabilityLabel: 'Udbetalinger',
          requirementId: 'add-bank-account',
          label: 'Udbetalinger: Bankkonto (IBAN) til udbetalinger mangler',
          status: 'currently-due',
          dashboardUrl: 'https://my.mollie.com/dashboard/onboarding/bank',
        },
      ],
    });

    expect(item.missingItems).toContain(
      'Udbetalinger: Bankkonto (IBAN) til udbetalinger mangler',
    );
    expect(item.missingItems).not.toContain('Mollie kræver yderligere KYC-oplysninger');
  });

  it('marks locally collected Mollie requirements', () => {
    const item = toListItem({
      ...baseRecord,
      connected: true,
      localKyc: {
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
          },
        ],
        bankAccount: {
          accountHolderName: 'Restaurant ApS',
          iban: 'DK5000400440116243',
        },
        validationPassed: true,
        validationErrors: [],
        validationWarnings: [],
        documentsUploaded: true,
        collectedAt: new Date(),
      },
      capabilityRequirements: [
        {
          capability: 'settlements',
          capabilityLabel: 'Udbetalinger',
          requirementId: 'add-bank-account',
          label: 'Udbetalinger: Bankkonto (IBAN) til udbetalinger mangler',
          status: 'currently-due',
        },
      ],
    });

    expect(item.missingItems.some((item) => item.includes('indsamlet — bekræft hos Mollie'))).toBe(true);
  });

  it('builds completed flow when fully onboarded', () => {
    const stages = buildFlowStages({
      ...baseRecord,
      connected: true,
      mollieStatus: 'completed',
      canReceivePayments: true,
      canReceiveSettlements: true,
    });

    expect(stages.every((stage) => stage.state === 'completed')).toBe(true);
    expect(computeProgressPercent(stages)).toBe(100);
  });

  it('marks KYC stage as blocked when needs-data', () => {
    const stages = buildFlowStages({
      ...baseRecord,
      connected: true,
      mollieStatus: 'needs-data',
    });

    const kyc = stages.find((stage) => stage.key === 'kyc');
    expect(kyc?.state).toBe('blocked');
  });

  it('includes settlement missing item when payments enabled but not settlements and no capabilities', () => {
    const missing = computeMissingItems(
      {
        ...baseRecord,
        connected: true,
        mollieStatus: 'needs-data',
        canReceivePayments: true,
        canReceiveSettlements: false,
      },
      [],
    );

    expect(missing).toContain('Bankkonto til udbetalinger (udfyldes hos Mollie)');
  });
});
