import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MollieClient } from '../integrations/mollie/mollie.client';
import { MerchantTokenStore } from '../merchants/merchant-token.store';
import { InitiateOnboardingDto } from './dto/initiate-onboarding.dto';
import { OnboardingService } from './onboarding.service';

const mockMollieClient = {
  createClientLink: jest.fn(),
  exchangeAuthCode: jest.fn(),
  refreshAccessToken: jest.fn(),
  getOnboardingStatus: jest.fn(),
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

const mockConfigService = {
  get: jest.fn().mockReturnValue({
    clientId: 'app_test',
    clientSecret: 'secret',
    accessToken: 'access_test',
    redirectUri: 'https://example.com/callback',
    apiBaseUrl: 'https://api.mollie.com',
    oauthBaseUrl: 'https://my.mollie.com',
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
        merchantId: 'merchant-1',
        email: 'owner@restaurant.nl',
        givenName: 'Jan',
        familyName: 'de Vries',
        organizationName: 'Restaurant De Vries',
        address: { country: 'NL' },
      };

      const result = await service.initiateOnboarding(dto);

      expect(result.clientLinkId).toBe('cl_abc123');
      expect(result.redirectUrl).toContain('client_id=app_test');
      expect(result.redirectUrl).toContain('scope=');
      expect(result.redirectUrl).toContain('state=');
    });
  });

  describe('handleOAuthCallback', () => {
    it('exchanges the code and stores tokens', async () => {
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
      expect(result.merchantId).toBe('state_merchant-1');
    });
  });

  describe('getOnboardingStatus', () => {
    it('returns mapped onboarding status', async () => {
      mockTokenStore.isTokenExpired.mockReturnValue(false);
      mockTokenStore.getAccessToken.mockReturnValue('access_xyz');
      mockMollieClient.getOnboardingStatus.mockResolvedValue({
        resource: 'onboarding',
        name: 'Restaurant De Vries',
        signedUpAt: '2024-01-01T00:00:00+00:00',
        status: 'needs-data',
        canReceivePayments: false,
        canReceiveSettlements: false,
        _links: { self: { href: 'https://...', type: 'application/hal+json' } },
      });

      const result = await service.getOnboardingStatus('merchant-1');

      expect(result.status).toBe('needs-data');
      expect(result.canReceivePayments).toBe(false);
      expect(result.message).toContain('more information');
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
