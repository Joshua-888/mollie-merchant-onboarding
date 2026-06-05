import {
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
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      return {
        success: false,
        error,
        errorDescription,
      };
    }

    const result = await this.onboardingService.handleOAuthCallback(code, state);
    return {
      success: true,
      merchantId: result.merchantId,
      message: 'Authorization successful. You can now check the onboarding status.',
    };
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
   * POST /api/v1/onboarding/profiles/:profileId/methods/:methodId
   *
   * Enables a payment method on a merchant's profile.
   * Common methodIds: ideal, creditcard, bancontact, paypal, applepay, banktransfer
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
