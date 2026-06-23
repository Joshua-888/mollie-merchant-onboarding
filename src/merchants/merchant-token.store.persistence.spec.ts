import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MerchantTokenStore } from './merchant-token.store';

describe('MerchantTokenStore persistence', () => {
  let dataDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'merchant-tokens-'));
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

  it('persists OAuth tokens across store instances', () => {
    const store = new MerchantTokenStore();
    const expiresAt = new Date(Date.now() + 3_600_000);

    store.save('dk-persist-1', {
      accessToken: 'access_test',
      refreshToken: 'refresh_test',
      expiresAt,
      scope: 'onboarding.read',
    });

    const reloaded = new MerchantTokenStore();

    expect(reloaded.exists('dk-persist-1')).toBe(true);
    expect(reloaded.getAccessToken('dk-persist-1')).toBe('access_test');
    expect(reloaded.get('dk-persist-1').tokens.expiresAt).toBeInstanceOf(Date);
  });
});
