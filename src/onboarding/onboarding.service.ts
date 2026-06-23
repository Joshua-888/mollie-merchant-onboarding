import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, MOLLIE_OAUTH_SCOPES } from '../config/configuration';
import {
  DENMARK_COUNTRY_CODE,
  DENMARK_DEFAULT_LOCALE,
  DENMARK_LEGAL_ENTITIES,
  DENMARK_PAYMENT_METHODS,
  MOLLIE_ONBOARDING_FIELD_GROUPS,
} from '../config/denmark.config';
import { MollieClient } from '../integrations/mollie/mollie.client';
import {
  mapOnboardingStatus,
  mapProfile,
  mapTokenResponse,
  resolveClientLinkHref,
} from '../integrations/mollie/mollie.mapper';
import {
  CapabilitiesSummary,
  mapCapabilities,
} from '../integrations/mollie/mollie.capabilities.mapper';
import {
  ClientLinkResult,
  MerchantProfile,
  MolliePaymentMethodDto,
  OnboardingStatus,
} from '../integrations/mollie/mollie.types';
import { MerchantRegistry } from '../merchants/merchant-registry';
import { MerchantListItem } from '../merchants/merchant-flow';
import { MerchantTokenStore } from '../merchants/merchant-token.store';
import { CreateProfileDto } from './dto/create-profile.dto';
import { InitiateOnboardingDto } from './dto/initiate-onboarding.dto';
import {
  MerchantLocalKycSnapshot,
  normalizeIban,
  validateLocalKyc,
} from './kyc-validation';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly mollieConfig: AppConfig['mollie'];

  constructor(
    private readonly mollieClient: MollieClient,
    private readonly tokenStore: MerchantTokenStore,
    private readonly merchantRegistry: MerchantRegistry,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.mollieConfig = this.configService.get('mollie', { infer: true });
  }

  /**
   * Step 1: Create a Mollie Client Link and return the redirect URL.
   * The caller (frontend) should redirect the merchant to this URL.
   */
  async initiateOnboarding(dto: InitiateOnboardingDto): Promise<ClientLinkResult> {
    const kycValidation = validateLocalKyc(dto.localKyc, { legalEntity: dto.legalEntity });
    if (!kycValidation.valid) {
      throw new BadRequestException(kycValidation.errors.join('; '));
    }

    const localKycSnapshot = this.buildLocalKycSnapshot(dto, kycValidation);
    const state = dto.merchantId;

    const response = await this.mollieClient.createClientLink({
      owner: {
        email: dto.email,
        givenName: dto.givenName,
        familyName: dto.familyName,
        locale: dto.locale ?? DENMARK_DEFAULT_LOCALE,
      },
      name: dto.organizationName,
      address: {
        streetAndNumber: dto.address.streetAndNumber,
        postalCode: dto.address.postalCode,
        city: dto.address.city,
        country: dto.address.country ?? DENMARK_COUNTRY_CODE,
      },
      registrationNumber: dto.registrationNumber,
      vatNumber: dto.vatNumber ?? null,
      legalEntity: dto.legalEntity,
      incorporationDate: dto.incorporationDate ?? null,
    });

    const scopes = MOLLIE_OAUTH_SCOPES.join(' ');

    const clientLinkUrl = resolveClientLinkHref(response);
    if (!clientLinkUrl) {
      throw new BadRequestException(
        'Mollie returnerede ikke et client link. Kontroller at access token har clients.write og at API-kaldet lykkedes.',
      );
    }

    const params = new URLSearchParams({
      client_id: this.mollieConfig.clientId,
      state,
      scope: scopes,
    });

    const redirectUrl = `${clientLinkUrl}?${params.toString()}`;

    this.logger.log({
      action: 'initiateOnboarding',
      merchantId: dto.merchantId,
      clientLinkId: response.id,
    });

    this.merchantRegistry.registerFromInitiate(dto, response.id, localKycSnapshot);

    return {
      clientLinkId: response.id,
      merchantId: dto.merchantId,
      redirectUrl,
    };
  }

  /**
   * Step 2: Handle the OAuth callback. Exchange the authorization code for tokens
   * and store them against the merchantId encoded in the state.
   */
  async handleOAuthCallback(code: string, state: string): Promise<{ merchantId: string }> {
    if (!code?.trim()) {
      throw new BadRequestException('Missing authorization code from Mollie callback');
    }
    if (!state?.trim()) {
      throw new BadRequestException('Missing state parameter from Mollie callback');
    }

    const tokenDto = await this.mollieClient.exchangeAuthCode(code);
    const tokens = mapTokenResponse(tokenDto);

    // The state is used as the merchantId key for simplicity.
    // In production, store state→merchantId mapping in a short-lived cache (Redis/DB).
    this.tokenStore.save(state, tokens);
    this.merchantRegistry.markConnected(state);

    this.logger.log({ action: 'handleOAuthCallback', merchantId: state });

    try {
      await this.syncMerchant(state);
    } catch (error) {
      this.logger.warn({
        action: 'postConnectSyncFailed',
        merchantId: state,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return { merchantId: state };
  }

  /**
   * Step 3: Poll onboarding status for a merchant.
   */
  async getOnboardingStatus(merchantId: string): Promise<OnboardingStatus> {
    const accessToken = await this.resolveAccessToken(merchantId);
    const dto = await this.mollieClient.getOnboardingStatus(accessToken);
    const status = mapOnboardingStatus(dto);
    this.merchantRegistry.updateMollieStatus(merchantId, status);
    return status;
  }

  async getCapabilities(merchantId: string): Promise<CapabilitiesSummary> {
    const accessToken = await this.resolveAccessToken(merchantId);
    const dto = await this.mollieClient.listCapabilities(accessToken);
    const summary = mapCapabilities(dto);
    this.merchantRegistry.updateCapabilities(merchantId, summary);
    return summary;
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
      mode: this.mollieConfig.apiMode,
    });
    const profile = mapProfile(profileDto);
    try {
      const profiles = await this.listProfiles(dto.merchantId);
      this.merchantRegistry.updateProfileCount(dto.merchantId, profiles.length);
    } catch {
      this.merchantRegistry.updateProfileCount(dto.merchantId, 1);
    }
    return profile;
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
    const mapped = profiles.map(mapProfile);
    this.merchantRegistry.updateProfileCount(merchantId, mapped.length);
    return mapped;
  }

  listMerchants(): MerchantListItem[] {
    return this.merchantRegistry.listAllWithFlow();
  }

  getMerchant(merchantId: string): MerchantListItem {
    return this.merchantRegistry.getWithFlow(merchantId);
  }

  async syncMerchant(merchantId: string): Promise<MerchantListItem> {
    const record = this.merchantRegistry.get(merchantId);
    if (!record) {
      throw new NotFoundException(`Merchant not found: ${merchantId}`);
    }

    if (this.tokenStore.exists(merchantId)) {
      await this.getOnboardingStatus(merchantId);
      try {
        await this.getCapabilities(merchantId);
      } catch (error) {
        this.logger.warn({
          action: 'syncCapabilitiesFailed',
          merchantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      try {
        await this.listProfiles(merchantId);
      } catch {
        // Profiles may not be available yet during early onboarding.
      }
    }

    return this.merchantRegistry.getWithFlow(merchantId);
  }

  async syncAllMerchants(): Promise<MerchantListItem[]> {
    const merchants = this.merchantRegistry.listAll();

    for (const merchant of merchants) {
      if (this.tokenStore.exists(merchant.merchantId)) {
        try {
          await this.syncMerchant(merchant.merchantId);
        } catch (error) {
          this.logger.warn({
            action: 'syncMerchantFailed',
            merchantId: merchant.merchantId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return this.merchantRegistry.listAllWithFlow();
  }

  getDanishPaymentMethods() {
    return DENMARK_PAYMENT_METHODS;
  }

  getRequiredFields() {
    return {
      country: DENMARK_COUNTRY_CODE,
      currency: 'DKK',
      source: 'https://docs.mollie.com/reference/create-client-link',
      groups: MOLLIE_ONBOARDING_FIELD_GROUPS,
      legalEntities: DENMARK_LEGAL_ENTITIES,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private buildLocalKycSnapshot(
    dto: InitiateOnboardingDto,
    validation: ReturnType<typeof validateLocalKyc>,
  ): MerchantLocalKycSnapshot {
    return {
      ubos: dto.localKyc.ubos,
      bankAccount: {
        ...dto.localKyc.bankAccount,
        iban: normalizeIban(dto.localKyc.bankAccount.iban),
        bic: dto.localKyc.bankAccount.bic?.toUpperCase(),
      },
      validationPassed: validation.valid,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      collectedAt: new Date(),
    };
  }

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
