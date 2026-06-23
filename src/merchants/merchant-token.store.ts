import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OAuthTokens } from '../integrations/mollie/mollie.types';
import { JsonFileStore } from './persistence/json-file.store';

export interface StoredMerchantTokens {
  merchantId: string;
  tokens: OAuthTokens;
  createdAt: Date;
  updatedAt: Date;
}

type TokenStoreSnapshot = Record<string, StoredMerchantTokens>;

/**
 * File-backed token store for local development.
 * Tokens are stored in data/tokens.json (gitignored). Encrypt at rest in production.
 */
@Injectable()
export class MerchantTokenStore {
  private readonly logger = new Logger(MerchantTokenStore.name);
  private readonly store = new Map<string, StoredMerchantTokens>();
  private readonly fileStore = new JsonFileStore<TokenStoreSnapshot>('tokens.json', {});

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    const snapshot = this.fileStore.read();
    for (const [merchantId, entry] of Object.entries(snapshot)) {
      this.store.set(merchantId, entry);
    }
    if (this.store.size > 0) {
      this.logger.log({ action: 'loadFromDisk', tokenCount: this.store.size });
    }
  }

  private persist(): void {
    const snapshot: TokenStoreSnapshot = {};
    for (const [merchantId, entry] of this.store.entries()) {
      snapshot[merchantId] = entry;
    }
    this.fileStore.write(snapshot);
  }

  save(merchantId: string, tokens: OAuthTokens): void {
    const now = new Date();
    const existing = this.store.get(merchantId);
    this.store.set(merchantId, {
      merchantId,
      tokens,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.persist();
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
    this.persist();
    this.logger.log({ action: 'delete', merchantId });
  }
}
