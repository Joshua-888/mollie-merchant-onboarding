import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MollieClient } from '../integrations/mollie/mollie.client';
import { MerchantRegistry } from '../merchants/merchant-registry';
import { MerchantTokenStore } from '../merchants/merchant-token.store';
import { InitiateOnboardingDto } from './dto/initiate-onboarding.dto';
import { LocalKycDto } from './dto/kyc.dto';
import { OnboardingService } from './onboarding.service';

const mockMollieClient = {
  createClientLink: jest.fn(),
  exchangeAuthCode: jest.fn(),
  refreshAccessToken: jest.fn(),
  getOnboardingStatus: jest.fn(),
  listCapabilities: jest.fn(),
  createProfile: jest.fn(),
  listProfiles: jest.fn(),
  enablePaymentMethod: jest.fn(),
  listEnabledMethods: jest.fn(),
};

const mockTokenStore = {
  save: jest.fn(),
  get: jest.fn(),
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  isTokenExpired: jest.fn(),
  exists: jest.fn(),
  delete: jest.fn(),
};

const mockMerchantRegistry = {
  registerFromInitiate: jest.fn(),
  markConnected: jest.fn(),
  updateMollieStatus: jest.fn(),
  updateCapabilities: jest.fn(),
  updateProfileCount: jest.fn(),
  get: jest.fn(),
  getOrThrow: jest.fn(),
  listAll: jest.fn().mockReturnValue([]),
  listAllWithFlow: jest.fn().mockReturnValue([]),
  getWithFlow: jest.fn(),
};

const validLocalKyc: LocalKycDto = {
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
    accountHolderName: 'Restaurant Sørensen ApS',
    iban: 'DK5000400440116243',
  },
};

const mockConfigService = {
  get: jest.fn().mockReturnValue({
    clientId: 'app_test',
    clientSecret: 'secret',
    accessToken: 'access_test',
    redirectUri: 'https://example.com/callback',
    apiBaseUrl: 'https://api.mollie.com',
    oauthBaseUrl: 'https://my.mollie.com',
    apiMode: 'test',
  }),
};

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: MollieClient, useValue: mockMollieClient },
        { provide: MerchantTokenStore, useValue: mockTokenStore },
        { provide: MerchantRegistry, useValue: mockMerchantRegistry },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  describe('initiateOnboarding', () => {
    it('returns a redirect URL with required OAuth params', async () => {
      mockMollieClient.createClientLink.mockResolvedValue({
        resource: 'client-link',
        id: 'cl_abc123',
        clientLink: 'https://my.mollie.com/dashboard/client-link/cl_abc123',
        _links: {},
      });

      const dto: InitiateOnboardingDto = {
        merchantId: 'dk-merchant-1',
        email: 'ejer@restaurant.dk',
        givenName: 'Lars',
        familyName: 'Nielsen',
        organizationName: 'Restaurant Sørensen ApS',
        legalEntity: 'dk-anpartsselskab',
        registrationNumber: '12345678',
        address: {
          country: 'DK',
          city: 'København',
          postalCode: '2100',
          streetAndNumber: 'Nørregade 10',
        },
        website: 'https://restaurant.dk',
        phone: '+4512345678',
        profileEmail: 'betaling@restaurant.dk',
        localKyc: validLocalKyc,
      };

      const result = await service.initiateOnboarding(dto);

      expect(result.clientLinkId).toBe('cl_abc123');
      expect(result.redirectUrl).toContain('client_id=app_test');
      expect(result.redirectUrl).toContain('scope=');
      expect(result.redirectUrl).toContain('organizations.read');
      expect(result.redirectUrl).toContain('onboarding.read');
      expect(result.redirectUrl).toContain('profiles.write');
      expect(result.redirectUrl).toContain('state=dk-merchant-1');
      expect(mockMerchantRegistry.registerFromInitiate).toHaveBeenCalled();
    });
  });

  describe('handleOAuthCallback', () => {
    it('rejects missing authorization code', async () => {
      await expect(service.handleOAuthCallback('', 'state_merchant-1')).rejects.toThrow(
        'Missing authorization code',
      );
    });

    it('exchanges the code and stores tokens', async () => {
      mockMerchantRegistry.get.mockReturnValue({ merchantId: 'state_merchant-1', connected: true });
      mockMerchantRegistry.getWithFlow.mockReturnValue({ merchantId: 'state_merchant-1' });
      mockTokenStore.exists.mockReturnValue(true);
      mockTokenStore.isTokenExpired.mockReturnValue(false);
      mockTokenStore.getAccessToken.mockReturnValue('access_xyz');
      mockMollieClient.getOnboardingStatus.mockResolvedValue({
        resource: 'onboarding',
        name: 'Test Org',
        signedUpAt: '2024-01-01T00:00:00+00:00',
        status: 'needs-data',
        canReceivePayments: false,
        canReceiveSettlements: false,
        _links: { self: { href: '', type: '' } },
      });
      mockMollieClient.listCapabilities.mockResolvedValue({
        count: 0,
        _embedded: { capabilities: [] },
      });
      mockMollieClient.listProfiles.mockResolvedValue([]);
      mockMollieClient.exchangeAuthCode.mockResolvedValue({
        access_token: 'access_xyz',
        refresh_token: 'refresh_xyz',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'onboarding.read',
      });

      const result = await service.handleOAuthCallback('auth_code', 'state_merchant-1');

      expect(mockMollieClient.exchangeAuthCode).toHaveBeenCalledWith('auth_code');
      expect(mockTokenStore.save).toHaveBeenCalledWith(
        'state_merchant-1',
        expect.objectContaining({ accessToken: 'access_xyz', refreshToken: 'refresh_xyz' }),
      );
      expect(mockMerchantRegistry.markConnected).toHaveBeenCalledWith('state_merchant-1');
      expect(result.merchantId).toBe('state_merchant-1');
    });
  });

  describe('getOnboardingStatus', () => {
    it('returns mapped onboarding status', async () => {
      mockTokenStore.isTokenExpired.mockReturnValue(false);
      mockTokenStore.getAccessToken.mockReturnValue('access_xyz');
      mockMollieClient.getOnboardingStatus.mockResolvedValue({
        resource: 'onboarding',
        name: 'Restaurant Sørensen ApS',
        signedUpAt: '2024-01-01T00:00:00+00:00',
        status: 'needs-data',
        canReceivePayments: false,
        canReceiveSettlements: false,
        _links: { self: { href: 'https://...', type: 'application/hal+json' } },
      });

      const result = await service.getOnboardingStatus('merchant-1');

      expect(result.status).toBe('needs-data');
      expect(result.canReceivePayments).toBe(false);
      expect(result.message).toContain('Mollie');
    });
  });

  describe('getCapabilities', () => {
    it('maps and stores capability requirements', async () => {
      mockTokenStore.isTokenExpired.mockReturnValue(false);
      mockTokenStore.getAccessToken.mockReturnValue('access_xyz');
      mockMollieClient.listCapabilities.mockResolvedValue({
        count: 1,
        _embedded: {
          capabilities: [
            {
              resource: 'capability',
              name: 'settlements',
              status: 'disabled',
              requirements: [
                {
                  id: 'add-bank-account',
                  status: 'currently-due',
                  _links: {
                    dashboard: {
                      href: 'https://my.mollie.com/dashboard/onboarding/bank',
                      type: 'text/html',
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      const result = await service.getCapabilities('merchant-1');

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0].requirementId).toBe('add-bank-account');
      expect(mockMerchantRegistry.updateCapabilities).toHaveBeenCalledWith(
        'merchant-1',
        expect.objectContaining({ requirements: expect.any(Array) }),
      );
    });
  });

  describe('getOnboardingStatus — token refresh', () => {
    it('refreshes expired token before calling Mollie', async () => {
      mockTokenStore.isTokenExpired.mockReturnValue(true);
      mockTokenStore.getRefreshToken.mockReturnValue('refresh_old');
      mockMollieClient.refreshAccessToken.mockResolvedValue({
        access_token: 'access_new',
        refresh_token: 'refresh_new',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'onboarding.read',
      });
      mockMollieClient.getOnboardingStatus.mockResolvedValue({
        resource: 'onboarding',
        name: 'Test',
        signedUpAt: '2024-01-01T00:00:00+00:00',
        status: 'completed',
        canReceivePayments: true,
        canReceiveSettlements: true,
        _links: { self: { href: '', type: '' } },
      });

      await service.getOnboardingStatus('merchant-1');

      expect(mockMollieClient.refreshAccessToken).toHaveBeenCalledWith('refresh_old');
      expect(mockTokenStore.save).toHaveBeenCalled();
    });
  });
});
