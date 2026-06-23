import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  BankAccountValidationResult,
  formatIban,
  normalizeBic,
  suggestBicFromIban,
  validateBankAccount,
} from '../bank/bank-validation';

interface IbanToolsIbanResponse {
  valid: boolean;
  iban?: string;
  formatted_iban?: string;
  country_code?: string;
  bank_code?: string;
  country_name?: string;
}

interface IbanToolsSwiftResponse {
  found: boolean;
  swift_code?: string;
  bank_name?: string;
  country_code?: string;
  country_name?: string;
}

@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);
  private readonly ibanToolsBaseUrl = 'https://ibantools.org/api/v1';

  async validate(iban: string, bic?: string): Promise<BankAccountValidationResult & {
    iban: BankAccountValidationResult['iban'] & { bankName?: string; countryName?: string };
    bic?: BankAccountValidationResult['bic'] & { bankName?: string; countryName?: string };
  }> {
    const local = validateBankAccount(iban, bic);
    const enriched = { ...local, iban: { ...local.iban }, bic: local.bic ? { ...local.bic } : undefined };

    if (local.iban.valid) {
      await this.enrichIban(enriched);
    }

    if (bic?.trim() && enriched.bic?.valid) {
      await this.enrichBic(enriched, bic);
    }

    enriched.valid = enriched.iban.valid && (enriched.bic ? enriched.bic.valid : true);

    if (!enriched.bic?.normalized && enriched.suggestedBic) {
      enriched.suggestedBic = enriched.suggestedBic;
    }

    return enriched;
  }

  private async enrichIban(result: BankAccountValidationResult & {
    iban: BankAccountValidationResult['iban'] & { bankName?: string; countryName?: string };
  }): Promise<void> {
    try {
      const response = await axios.get<IbanToolsIbanResponse>(
        `${this.ibanToolsBaseUrl}/iban/validate/${encodeURIComponent(result.iban.normalized)}`,
        { timeout: 8_000 },
      );

      if (!response.data.valid) {
        result.iban.valid = false;
        result.iban.errors.push('IBAN kunne ikke verificeres eksternt');
        return;
      }

      result.iban.formatted = response.data.formatted_iban ?? formatIban(result.iban.normalized);
      result.iban.countryCode = response.data.country_code ?? result.iban.countryCode;
      result.iban.bankCode = response.data.bank_code ?? result.iban.bankCode;
      (result.iban as { countryName?: string }).countryName = response.data.country_name;

      if (!result.suggestedBic) {
        result.suggestedBic = suggestBicFromIban(result.iban.normalized);
      }
    } catch (error) {
      this.logger.warn({ action: 'enrichIban', message: 'IBANTools lookup failed — using local validation only' });
    }
  }

  private async enrichBic(
    result: BankAccountValidationResult & {
      bic?: BankAccountValidationResult['bic'] & { bankName?: string; countryName?: string };
    },
    bic: string,
  ): Promise<void> {
    const normalized = normalizeBic(bic);

    try {
      const response = await axios.get<IbanToolsSwiftResponse>(
        `${this.ibanToolsBaseUrl}/swift/${encodeURIComponent(normalized)}`,
        { timeout: 8_000, validateStatus: (status) => status < 500 },
      );

      if (!response.data.found) {
        result.bic!.valid = false;
        result.bic!.errors.push('BIC/SWIFT blev ikke fundet i registret');
        return;
      }

      result.bic!.bankName = response.data.bank_name;
      (result.bic as { countryName?: string }).countryName = response.data.country_name;
      result.bic!.countryCode = response.data.country_code ?? result.bic!.countryCode;

      if (result.iban.countryCode && result.bic!.countryCode) {
        result.bic!.matchesIbanCountry = result.iban.countryCode === result.bic!.countryCode;
        if (!result.bic!.matchesIbanCountry) {
          result.bic!.valid = false;
          result.bic!.errors.push(
            `BIC landekode (${result.bic!.countryCode}) matcher ikke IBAN (${result.iban.countryCode})`,
          );
        }
      }
    } catch (error) {
      this.logger.warn({ action: 'enrichBic', message: 'IBANTools SWIFT lookup failed — using format validation only' });
    }
  }
}
