import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { AppConfig } from '../../config/configuration';
import {
  MollieAuthError,
  MollieError,
  MollieNotFoundError,
  MollieRateLimitError,
  MollieUpstreamError,
  MollieValidationError,
} from './mollie.errors';
import {
  MollieClientLinkRequestDto,
  MollieClientLinkResponseDto,
  MollieOnboardingStatusDto,
  MolliePaymentMethodDto,
  MollieProfileRequestDto,
  MollieProfileResponseDto,
  MollieTokenResponseDto,
} from './mollie.types';

@Injectable()
export class MollieClient {
  private readonly logger = new Logger(MollieClient.name);
  private readonly apiClient: AxiosInstance;
  private readonly oauthClient: AxiosInstance;
  private readonly config: AppConfig['mollie'];

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.config = this.configService.get('mollie', { infer: true });

    this.apiClient = this.buildClient(this.config.apiBaseUrl);
    this.oauthClient = this.buildClient(this.config.oauthBaseUrl);

    axiosRetry(this.apiClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        const status = error.response?.status;
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || status === 429 || (!!status && status >= 500);
      },
      onRetry: (retryCount, error) => {
        this.logger.warn({
          message: 'Retrying Mollie request',
          retryCount,
          url: error.config?.url,
          status: error.response?.status,
        });
      },
    });
  }

  private buildClient(baseURL: string): AxiosInstance {
    return axios.create({
      baseURL,
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Client Links ──────────────────────────────────────────────────────────

  async createClientLink(data: MollieClientLinkRequestDto): Promise<MollieClientLinkResponseDto> {
    return this.request<MollieClientLinkResponseDto>({
      method: 'POST',
      url: '/v2/client-links',
      data,
      token: this.config.accessToken,
      operation: 'createClientLink',
    });
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────

  async exchangeAuthCode(code: string): Promise<MollieTokenResponseDto> {
    const start = Date.now();
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await this.oauthClient.post<MollieTokenResponseDto>(
        '/oauth2/tokens',
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );

      this.logger.log({
        system: 'mollie',
        operation: 'exchangeAuthCode',
        durationMs: Date.now() - start,
        status: 'success',
      });

      return response.data;
    } catch (error) {
      this.logger.error({
        system: 'mollie',
        operation: 'exchangeAuthCode',
        durationMs: Date.now() - start,
        status: 'error',
      });
      throw this.wrapError(error);
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<MollieTokenResponseDto> {
    const start = Date.now();
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await this.oauthClient.post<MollieTokenResponseDto>(
        '/oauth2/tokens',
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );

      this.logger.log({
        system: 'mollie',
        operation: 'refreshAccessToken',
        durationMs: Date.now() - start,
        status: 'success',
      });

      return response.data;
    } catch (error) {
      this.logger.error({
        system: 'mollie',
        operation: 'refreshAccessToken',
        durationMs: Date.now() - start,
        status: 'error',
      });
      throw this.wrapError(error);
    }
  }

  // ─── Onboarding ───────────────────────────────────────────────────────────

  async getOnboardingStatus(merchantAccessToken: string): Promise<MollieOnboardingStatusDto> {
    return this.request<MollieOnboardingStatusDto>({
      method: 'GET',
      url: '/v2/onboarding/me',
      token: merchantAccessToken,
      operation: 'getOnboardingStatus',
    });
  }

  // ─── Profiles ─────────────────────────────────────────────────────────────

  async createProfile(
    merchantAccessToken: string,
    data: MollieProfileRequestDto,
  ): Promise<MollieProfileResponseDto> {
    return this.request<MollieProfileResponseDto>({
      method: 'POST',
      url: '/v2/profiles',
      data,
      token: merchantAccessToken,
      operation: 'createProfile',
    });
  }

  async listProfiles(merchantAccessToken: string): Promise<MollieProfileResponseDto[]> {
    const response = await this.request<{ _embedded: { profiles: MollieProfileResponseDto[] } }>({
      method: 'GET',
      url: '/v2/profiles',
      token: merchantAccessToken,
      operation: 'listProfiles',
    });
    return response._embedded?.profiles ?? [];
  }

  // ─── Payment Methods ──────────────────────────────────────────────────────

  async enablePaymentMethod(
    merchantAccessToken: string,
    profileId: string,
    methodId: string,
  ): Promise<MolliePaymentMethodDto> {
    return this.request<MolliePaymentMethodDto>({
      method: 'POST',
      url: `/v2/profiles/${profileId}/methods/${methodId}`,
      token: merchantAccessToken,
      operation: 'enablePaymentMethod',
    });
  }

  async listEnabledMethods(
    merchantAccessToken: string,
    profileId: string,
  ): Promise<MolliePaymentMethodDto[]> {
    const response = await this.request<{ _embedded: { methods: MolliePaymentMethodDto[] } }>({
      method: 'GET',
      url: `/v2/profiles/${profileId}/methods`,
      token: merchantAccessToken,
      operation: 'listEnabledMethods',
    });
    return response._embedded?.methods ?? [];
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async request<T>(opts: {
    method: AxiosRequestConfig['method'];
    url: string;
    data?: unknown;
    token: string;
    operation: string;
  }): Promise<T> {
    const start = Date.now();
    try {
      const response = await this.apiClient.request<T>({
        method: opts.method,
        url: opts.url,
        data: opts.data,
        headers: { Authorization: `Bearer ${opts.token}` },
      });

      this.logger.log({
        system: 'mollie',
        operation: opts.operation,
        durationMs: Date.now() - start,
        status: 'success',
      });

      return response.data;
    } catch (error) {
      this.logger.error({
        system: 'mollie',
        operation: opts.operation,
        durationMs: Date.now() - start,
        status: 'error',
      });
      throw this.wrapError(error);
    }
  }

  private wrapError(error: unknown): MollieError {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data, headers } = error.response;
      const requestId = headers?.['x-request-id'] as string | undefined;
      const detail = data?.detail ?? 'An unexpected error occurred';
      const field = data?.field as string | undefined;

      switch (status) {
        case 400:
        case 422:
          return new MollieValidationError(detail, field, requestId);
        case 401:
        case 403:
          return new MollieAuthError(detail, requestId);
        case 404:
          return new MollieNotFoundError(detail, requestId);
        case 429:
          return new MollieRateLimitError(requestId);
        default:
          return new MollieUpstreamError(detail, status, requestId);
      }
    }
    return new MollieUpstreamError('Network error communicating with Mollie', 503);
  }
}
