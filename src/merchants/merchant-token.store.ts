import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OAuthTokens } from '../integrations/mollie/mollie.types';

export interface StoredMerchantTokens {
  merchantId: string;
  tokens: OAuthTokens;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory token store. Replace with a DB-backed implementation in production.
 * Tokens should be encrypted at rest when persisted.
 */
@Injectable()
export class MerchantTokenStore {
  private readonly logger = new Logger(MerchantTokenStore.name);
  private readonly store = new Map<string, StoredMerchantTokens>();

  save(merchantId: string, tokens: OAuthTokens): void {
    const now = new Date();
    const existing = this.store.get(merchantId);
    this.store.set(merchantId, {
      merchantId,
      tokens,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.logger.log({ action: 'save', merchantId });
  }

  get(merchantId: string): StoredMerchantTokens {
    const entry = this.store.get(merchantId);
    if (!entry) {
      throw new NotFoundException(`No tokens found for merchant: ${merchantId}`);
    }
    return entry;
  }

  getAccessToken(merchantId: string): string {
    const { tokens } = this.get(merchantId);
    return tokens.accessToken;
  }

  getRefreshToken(merchantId: string): string {
    const { tokens } = this.get(merchantId);
    return tokens.refreshToken;
  }

  isTokenExpired(merchantId: string): boolean {
    const { tokens } = this.get(merchantId);
    return tokens.expiresAt <= new Date();
  }

  exists(merchantId: string): boolean {
    return this.store.has(merchantId);
  }

  delete(merchantId: string): void {
    this.store.delete(merchantId);
    this.logger.log({ action: 'delete', merchantId });
  }
}
