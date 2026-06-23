import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MerchantRegistry } from './merchant-registry';
import { InitiateOnboardingDto } from '../onboarding/dto/initiate-onboarding.dto';

describe('MerchantRegistry persistence', () => {
  let dataDir: string;
  let originalDataDir: string | undefined;

  const initiateDto: InitiateOnboardingDto = {
    merchantId: 'dk-persist-1',
    email: 'ejer@takeawayhero.dk',
    givenName: 'Test',
    familyName: 'Merchant',
    organizationName: 'TakeAwayHero ApS',
    legalEntity: 'dk-anpartsselskab',
    registrationNumber: '45586707',
    address: {
      country: 'DK',
      city: 'Holbæk',
      postalCode: '4300',
      streetAndNumber: 'Hirsevænget 15',
    },
    website: 'https://takeawayhero.dk',
    phone: '+4512345678',
    profileEmail: 'betaling@takeawayhero.dk',
    localKyc: {
      ubos: [
        {
          givenName: 'Test',
          familyName: 'Merchant',
          dateOfBirth: '1985-01-01',
          nationality: 'DK',
          ownershipPercent: 100,
          isPseudoUbo: false,
        },
      ],
      bankAccount: {
        accountHolderName: 'TakeAwayHero ApS',
        iban: 'DK5000400440116243',
      },
    },
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'merchant-registry-'));
    originalDataDir = process.env.MERCHANT_DATA_DIR;
    process.env.MERCHANT_DATA_DIR = dataDir;
  });

  afterEach(() => {
    if (originalDataDir === undefined) {
      delete process.env.MERCHANT_DATA_DIR;
    } else {
      process.env.MERCHANT_DATA_DIR = originalDataDir;
    }
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('persists merchants across registry instances', () => {
    const registry = new MerchantRegistry();
    registry.registerFromInitiate(initiateDto, 'cl_test', undefined);
    registry.markConnected(initiateDto.merchantId);

    const reloaded = new MerchantRegistry();
    const record = reloaded.get(initiateDto.merchantId);

    expect(record?.organizationName).toBe('TakeAwayHero ApS');
    expect(record?.connected).toBe(true);
    expect(record?.createdAt).toBeInstanceOf(Date);
    expect(readFileSync(join(dataDir, 'merchants.json'), 'utf8')).toContain('TakeAwayHero ApS');
  });
});
