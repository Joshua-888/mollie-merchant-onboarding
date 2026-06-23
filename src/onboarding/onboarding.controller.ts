import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Redirect,
} from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { InitiateOnboardingDto } from './dto/initiate-onboarding.dto';
import { OnboardingService } from './onboarding.service';
import { MollieError } from '../integrations/mollie/mollie.errors';

function resolveOAuthCallbackError(err: unknown): string {
  if (err instanceof BadRequestException) {
    const response = err.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const message = (response as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join('; ');
      if (typeof message === 'string') return message;
    }
  }
  if (err instanceof MollieError) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'OAuth callback failed.';
}

@Controller('api/v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * POST /api/v1/onboarding/initiate
   *
   * Starts the merchant onboarding flow. Returns a redirect URL that your
   * frontend should send the merchant to.
   */
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiateOnboarding(@Body() dto: InitiateOnboardingDto) {
    const result = await this.onboardingService.initiateOnboarding(dto);
    return {
      clientLinkId: result.clientLinkId,
      merchantId: result.merchantId,
      redirectUrl: result.redirectUrl,
      message: 'Redirect the merchant to the provided URL to complete authorization.',
    };
  }

  /**
   * GET /api/v1/onboarding/callback?code=...&state=...
   *
   * Mollie calls this after the merchant authorizes your app.
   * Exchanges the authorization code for OAuth tokens.
   */
  @Get('callback')
  @Redirect()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      const params = new URLSearchParams({
        error,
        errorDescription: errorDescription ?? 'Authorization was denied or failed.',
      });
      return { url: `/dashboard.html?${params.toString()}`, statusCode: 302 };
    }

    let merchantId: string;
    try {
      ({ merchantId } = await this.onboardingService.handleOAuthCallback(code, state));
    } catch (err) {
      const params = new URLSearchParams({
        error: 'callback_failed',
        errorDescription: resolveOAuthCallbackError(err),
      });
      if (state?.trim()) {
        params.set('merchantId', state.trim());
      }
      return { url: `/dashboard.html?${params.toString()}`, statusCode: 302 };
    }

    const params = new URLSearchParams({
      merchantId,
      connected: 'true',
    });
    return { url: `/dashboard.html?${params.toString()}`, statusCode: 302 };
  }

  /**
   * GET /api/v1/onboarding/status/:merchantId
   *
   * Returns the current onboarding status for a merchant.
   */
  @Get('status/:merchantId')
  async getOnboardingStatus(@Param('merchantId') merchantId: string) {
    const status = await this.onboardingService.getOnboardingStatus(merchantId);
    return { merchantId, ...status };
  }

  /**
   * GET /api/v1/onboarding/capabilities/:merchantId
   *
   * Returns Mollie capability requirements with dashboard deep links.
   */
  @Get('capabilities/:merchantId')
  async getCapabilities(@Param('merchantId') merchantId: string) {
    const capabilities = await this.onboardingService.getCapabilities(merchantId);
    return { merchantId, ...capabilities };
  }

  /**
   * GET /api/v1/onboarding/profiles/:merchantId
   *
   * Lists all payment profiles for a merchant.
   */
  @Get('profiles/:merchantId')
  async listProfiles(@Param('merchantId') merchantId: string) {
    const profiles = await this.onboardingService.listProfiles(merchantId);
    return { merchantId, profiles };
  }

  /**
   * POST /api/v1/onboarding/profiles
   *
   * Creates a new payment profile for a merchant.
   */
  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(@Body() dto: CreateProfileDto) {
    const profile = await this.onboardingService.createProfile(dto);
    return { profile };
  }

  /**
   * GET /api/v1/onboarding/merchants
   *
   * Lists all merchants sent for onboarding with status flow and missing items.
   */
  @Get('merchants')
  async listMerchants(@Query('sync') sync?: string) {
    if (sync === 'true') {
      const merchants = await this.onboardingService.syncAllMerchants();
      return { count: merchants.length, merchants };
    }
    const merchants = this.onboardingService.listMerchants();
    return { count: merchants.length, merchants };
  }

  /**
   * GET /api/v1/onboarding/merchants/:merchantId
   */
  @Get('merchants/:merchantId')
  async getMerchant(
    @Param('merchantId') merchantId: string,
    @Query('sync') sync?: string,
  ) {
    if (sync === 'true') {
      const merchant = await this.onboardingService.syncMerchant(merchantId);
      return { merchant };
    }
    const merchant = this.onboardingService.getMerchant(merchantId);
    return { merchant };
  }

  /**
   * POST /api/v1/onboarding/merchants/sync
   *
   * Refreshes Mollie status for all connected merchants.
   */
  @Post('merchants/sync')
  @HttpCode(HttpStatus.OK)
  async syncAllMerchants() {
    const merchants = await this.onboardingService.syncAllMerchants();
    return { count: merchants.length, merchants };
  }

  /**
   * POST /api/v1/onboarding/merchants/:merchantId/sync
   */
  @Post('merchants/:merchantId/sync')
  @HttpCode(HttpStatus.OK)
  async syncMerchant(@Param('merchantId') merchantId: string) {
    const merchant = await this.onboardingService.syncMerchant(merchantId);
    return { merchant };
  }

  /**
   * GET /api/v1/onboarding/required-fields
   *
   * Documents Mollie-required fields for Danish merchant approval.
   */
  @Get('required-fields')
  getRequiredFields() {
    return this.onboardingService.getRequiredFields();
  }

  /**
   * GET /api/v1/onboarding/payment-methods
   *
   * Returns recommended Danish payment methods for Mollie profiles.
   */
  @Get('payment-methods')
  getPaymentMethods() {
    return {
      country: 'DK',
      currency: 'DKK',
      methods: this.onboardingService.getDanishPaymentMethods(),
    };
  }

  /**
   * POST /api/v1/onboarding/profiles/:profileId/methods/:methodId
   *
   * Enables a payment method on a merchant's profile.
   * Danish methodIds: mobilepay, creditcard, applepay, paypal, banktransfer, klarna
   */
  @Post('profiles/:profileId/methods/:methodId')
  @HttpCode(HttpStatus.OK)
  async enablePaymentMethod(
    @Param('profileId') profileId: string,
    @Param('methodId') methodId: string,
    @Query('merchantId') merchantId: string,
  ) {
    const method = await this.onboardingService.enablePaymentMethod(
      merchantId,
      profileId,
      methodId,
    );
    return { profileId, method };
  }

  /**
   * GET /api/v1/onboarding/profiles/:profileId/methods?merchantId=...
   *
   * Lists enabled payment methods on a merchant's profile.
   */
  @Get('profiles/:profileId/methods')
  async listPaymentMethods(
    @Param('profileId') profileId: string,
    @Query('merchantId') merchantId: string,
  ) {
    const methods = await this.onboardingService.listPaymentMethods(merchantId, profileId);
    return { profileId, methods };
  }
}
