import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { AppConfig } from '../../config/configuration';
import {
  CvrNotFoundError,
  CvrRateLimitError,
  CvrValidationError,
  CvrError,
} from './cvr.errors';
import {
  CvrCompanyResponseDto,
  CvrSearchResponseDto,
  CvrSuggestionsResponseDto,
} from './cvr.types';

interface LegacyCvrOwner {
  name?: string;
}

interface LegacyCvrResponse {
  vat?: number;
  name?: string;
  address?: string;
  zipcode?: string | number;
  city?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  startdate?: string | null;
  industrydesc?: string | null;
  companycode?: number;
  companydesc?: string;
  addressco?: string | null;
  owners?: LegacyCvrOwner[] | null;
  error?: string;
  message?: string;
}

@Injectable()
export class CvrClient {
  private readonly logger = new Logger(CvrClient.name);
  private readonly dataCvrClient: AxiosInstance;
  private readonly legacyClient: AxiosInstance;
  private readonly apiKey?: string;
  private readonly useDataCvr: boolean;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const cvrConfig = this.configService.get('cvr', { infer: true });
    this.apiKey = cvrConfig.apiKey;
    this.useDataCvr = Boolean(this.apiKey);

    this.dataCvrClient = axios.create({
      baseURL: cvrConfig.baseUrl,
      timeout: 10_000,
      headers: { Accept: 'application/json' },
    });

    this.legacyClient = axios.create({
      baseURL: 'https://cvrapi.dk/api',
      timeout: 10_000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Takeawayhero-Mollie-Onboarding/1.0',
      },
    });

    axiosRetry(this.dataCvrClient, {
      retries: 2,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        const status = error.response?.status;
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || status === 429 || (!!status && status >= 500);
      },
    });

    if (!this.useDataCvr) {
      this.logger.warn(
        'CVR_API_KEY not set — using legacy cvrapi.dk fallback (single-result name search). ' +
          'Add a free key from https://datacvrapi.dk/opret-konto for full autocomplete.',
      );
    }
  }

  async suggestCompanies(query: string): Promise<CvrSuggestionsResponseDto> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      throw new CvrValidationError('Søgning kræver mindst 2 tegn');
    }

    if (this.useDataCvr) {
      return this.requestDataCvr<CvrSuggestionsResponseDto>({
        url: `/dk/suggestions/company/${encodeURIComponent(trimmed)}`,
        operation: 'suggestCompanies',
      });
    }

    const company = await this.legacyLookup(trimmed, 'suggestCompanies');
    return {
      suggestions: company
        ? [
            {
              vat: company.vat,
              name: company.name,
              address: [company.address, company.zipcode, company.city].filter(Boolean).join(', '),
            },
          ]
        : [],
    };
  }

  async searchCompanies(query: string, limit = 10): Promise<CvrSearchResponseDto> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      throw new CvrValidationError('Søgning kræver mindst 2 tegn');
    }

    if (this.useDataCvr) {
      return this.requestDataCvr<CvrSearchResponseDto>({
        url: '/dk/search/company',
        params: { name: trimmed, limit },
        operation: 'searchCompanies',
      });
    }

    const company = await this.legacyLookup(trimmed, 'searchCompanies');
    return {
      total: company ? 1 : 0,
      limit,
      offset: 0,
      results: company ? [company] : [],
    };
  }

  async getCompanyByCvr(cvr: string): Promise<CvrCompanyResponseDto> {
    if (!/^[0-9]{8}$/.test(cvr)) {
      throw new CvrValidationError('CVR-nummer skal være 8 cifre');
    }

    if (this.useDataCvr) {
      return this.requestDataCvr<CvrCompanyResponseDto>({
        url: `/dk/company/${cvr}`,
        operation: 'getCompanyByCvr',
      });
    }

    const company = await this.legacyLookup(cvr, 'getCompanyByCvr');
    if (!company) {
      throw new CvrNotFoundError();
    }
    return company;
  }

  private async legacyLookup(query: string, operation: string): Promise<CvrCompanyResponseDto | null> {
    const start = Date.now();
    try {
      const response = await this.legacyClient.get<LegacyCvrResponse>('', {
        params: { search: query, country: 'dk' },
      });
      const data = response.data;

      if (!data?.vat || data.error) {
        this.logger.log({ system: 'cvr-legacy', operation, durationMs: Date.now() - start, status: 'not_found' });
        return null;
      }

      this.logger.log({ system: 'cvr-legacy', operation, durationMs: Date.now() - start, status: 'success' });
      return this.mapLegacyCompany(data);
    } catch (error) {
      this.logger.warn({ system: 'cvr-legacy', operation, durationMs: Date.now() - start, status: 'error' });
      throw this.wrapError(error);
    }
  }

  private mapLegacyCompany(data: LegacyCvrResponse): CvrCompanyResponseDto {
    return {
      vat: data.vat!,
      name: data.name ?? '',
      address: data.address,
      addressco: data.addressco,
      zipcode: data.zipcode != null ? String(data.zipcode) : undefined,
      city: data.city,
      phone: data.phone,
      email: data.email,
      website: data.website,
      startdate: data.startdate,
      industrydesc: data.industrydesc,
      companycode: data.companycode,
      companydesc: data.companydesc,
      owners:
        data.owners?.map((owner) => ({
          name: owner.name,
          active: true,
        })) ?? null,
    };
  }

  private async requestDataCvr<T>(opts: {
    url: string;
    params?: Record<string, string | number>;
    operation: string;
  }): Promise<T> {
    const start = Date.now();
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey!,
      Authorization: `Bearer ${this.apiKey}`,
    };

    try {
      const response = await this.dataCvrClient.request<T>({
        method: 'GET',
        url: opts.url,
        params: opts.params,
        headers,
      });

      this.logger.log({
        system: 'cvr',
        operation: opts.operation,
        durationMs: Date.now() - start,
        status: 'success',
      });

      return response.data;
    } catch (error) {
      this.logger.warn({
        system: 'cvr',
        operation: opts.operation,
        durationMs: Date.now() - start,
        status: 'error',
      });
      throw this.wrapError(error);
    }
  }

  private wrapError(error: unknown): CvrError {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response;
      const detail =
        (typeof data === 'object' && data && 'message' in data && String(data.message)) ||
        (typeof data === 'object' && data && 'error' in data && String(data.error)) ||
        'CVR API fejl';

      switch (status) {
        case 400:
        case 422:
          return new CvrValidationError(detail);
        case 404:
          return new CvrNotFoundError(detail);
        case 429:
          return new CvrRateLimitError(detail);
        default:
          return new CvrError(detail, status >= 500 ? 502 : status);
      }
    }

    return new CvrError('Netværksfejl ved kontakt til CVR API', 502);
  }
}
