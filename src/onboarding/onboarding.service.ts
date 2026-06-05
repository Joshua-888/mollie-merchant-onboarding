import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { AppConfig } from '../config/configuration';
import { MollieClient } from '../integrations/mollie/mollie.client';
import {
  mapOnboardingStatus,
  mapProfile,
  mapTokenResponse,
} from '../integrations/mollie/mollie.mapper';
import {
  ClientLinkResult,
  MerchantProfile,
  MolliePaymentMethodDto,
  OnboardingStatus,
} from '../integrations/mollie/mollie.types';
import { MerchantTokenStore } from '../merchants/merchant-token.store';
import { CreateProfileDto } from './dto/create-profile.dto';
import { InitiateOnboardingDto } from './dto/initiate-onboarding.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly mollieConfig: AppConfig['mollie'];

  constructor(
    private readonly mollieClient: MollieClient,
    private readonly tokenStore: MerchantTokenStore,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.mollieConfig = this.configService.get('mollie', { infer: true });
  }

  /**
   * Step 1: Create a Mollie Client Link and return the redirect URL.
   * The caller (frontend) should redirect the merchant to this URL.
   */
  async initiateOnboarding(dto: InitiateOnboardingDto): Promise<ClientLinkResult> {
    const state = uuidv4();

    const response = await this.mollieClient.createClientLink({
      owner: {
        email: dto.email,
        givenName: dto.givenName,
        familyName: dto.familyName,
        locale: dto.locale ?? null,
      },
      name: dto.organizationName,
      address: dto.address
        ? {
            streetAndNumber: dto.address.streetAndNumber,
            postalCode: dto.address.postalCode,
            city: dto.address.city,
            country: dto.address.country,
          }
        : undefined,
      registrationNumber: dto.registrationNumber,
      vatNumber: dto.vatNumber,
    });

    const scopes = [
      'onboarding.read',
      'onboarding.write',
      'profiles.read',
      'profiles.write',
      'payments.read',
      'payments.write',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.mollieConfig.clientId,
      state,
      scope: scopes,
    });

    const redirectUrl = `${response.clientLink}?${params.toString()}`;

    this.logger.log({
      action: 'initiateOnboarding',
      merchantId: dto.merchantId,
      clientLinkId: response.id,
    });

    return {
      clientLinkId: response.id,
      redirectUrl,
    };
  }

  /**
   * Step 2: Handle the OAuth callback. Exchange the authorization code for tokens
   * and store them against the merchantId encoded in the state.
   */
  async handleOAuthCallback(code: string, state: string): Promise<{ merchantId: string }> {
    const tokenDto = await this.mollieClient.exchangeAuthCode(code);
    const tokens = mapTokenResponse(tokenDto);

    // The state is used as the merchantId key for simplicity.
    // In production, store state→merchantId mapping in a short-lived cache (Redis/DB).
    this.tokenStore.save(state, tokens);

    this.logger.log({ action: 'handleOAuthCallback', merchantId: state });

    return { merchantId: state };
  }

  /**
   * Step 3: Poll onboarding status for a merchant.
   */
  async getOnboardingStatus(merchantId: string): Promise<OnboardingStatus> {
    const accessToken = await this.resolveAccessToken(merchantId);
    const dto = await this.mollieClient.getOnboardingStatus(accessToken);
    return mapOnboardingStatus(dto);
  }

  /**
   * Step 4: Create a payment profile for the merchant.
   */
  async createProfile(dto: CreateProfileDto): Promise<MerchantProfile> {
    const accessToken = await this.resolveAccessToken(dto.merchantId);
    const profileDto = await this.mollieClient.createProfile(accessToken, {
      name: dto.name,
      website: dto.website,
      email: dto.email,
      phone: dto.phone,
      mode: 'live',
    });
    return mapProfile(profileDto);
  }

  /**
   * Step 5a: Enable a payment method on a profile.
   */
  async enablePaymentMethod(
    merchantId: string,
    profileId: string,
    methodId: string,
  ): Promise<MolliePaymentMethodDto> {
    const accessToken = await this.resolveAccessToken(merchantId);
    return this.mollieClient.enablePaymentMethod(accessToken, profileId, methodId);
  }

  /**
   * Step 5b: List enabled payment methods on a profile.
   */
  async listPaymentMethods(
    merchantId: string,
    profileId: string,
  ): Promise<MolliePaymentMethodDto[]> {
    const accessToken = await this.resolveAccessToken(merchantId);
    return this.mollieClient.listEnabledMethods(accessToken, profileId);
  }

  /**
   * List all profiles for a merchant.
   */
  async listProfiles(merchantId: string): Promise<MerchantProfile[]> {
    const accessToken = await this.resolveAccessToken(merchantId);
    const profiles = await this.mollieClient.listProfiles(accessToken);
    return profiles.map(mapProfile);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Returns a valid (non-expired) access token for a merchant, refreshing if needed.
   */
  private async resolveAccessToken(merchantId: string): Promise<string> {
    if (!this.tokenStore.isTokenExpired(merchantId)) {
      return this.tokenStore.getAccessToken(merchantId);
    }

    this.logger.log({ action: 'refreshingToken', merchantId });
    const refreshToken = this.tokenStore.getRefreshToken(merchantId);
    const tokenDto = await this.mollieClient.refreshAccessToken(refreshToken);
    const tokens = mapTokenResponse(tokenDto);
    this.tokenStore.save(merchantId, tokens);
    return tokens.accessToken;
  }
}
