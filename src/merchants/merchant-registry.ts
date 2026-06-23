import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnboardingStatus } from '../integrations/mollie/mollie.types';
import { CapabilitiesSummary } from '../integrations/mollie/mollie.capabilities.mapper';
import { InitiateOnboardingDto } from '../onboarding/dto/initiate-onboarding.dto';
import { MerchantLocalKycSnapshot } from '../onboarding/kyc-validation';
import {
  MerchantListItem,
  MerchantRecord,
  recordFromInitiateDto,
  toListItem,
} from './merchant-flow';

@Injectable()
export class MerchantRegistry {
  private readonly logger = new Logger(MerchantRegistry.name);
  private readonly store = new Map<string, MerchantRecord>();

  registerFromInitiate(
    dto: InitiateOnboardingDto,
    clientLinkId: string,
    localKyc?: MerchantLocalKycSnapshot,
  ): MerchantRecord {
    const existing = this.store.get(dto.merchantId);
    const record = recordFromInitiateDto(dto, clientLinkId, localKyc);

    if (existing) {
      record.createdAt = existing.createdAt;
      record.connected = existing.connected;
      record.connectedAt = existing.connectedAt;
      record.profileCount = existing.profileCount;
      record.mollieStatus = existing.mollieStatus;
      record.canReceivePayments = existing.canReceivePayments;
      record.canReceiveSettlements = existing.canReceiveSettlements;
      record.dashboardUrl = existing.dashboardUrl;
      record.statusMessage = existing.statusMessage;
      record.capabilityRequirements = existing.capabilityRequirements;
      record.capabilitiesSummary = existing.capabilitiesSummary;
      if (!localKyc && existing.localKyc) {
        record.localKyc = existing.localKyc;
      }
    }

    this.store.set(dto.merchantId, record);
    this.logger.log({ action: 'register', merchantId: dto.merchantId });
    return record;
  }

  markConnected(merchantId: string): void {
    const now = new Date();
    const existing = this.store.get(merchantId);

    const record: MerchantRecord = existing ?? {
      merchantId,
      email: '',
      givenName: '',
      familyName: '',
      organizationName: '',
      legalEntity: '',
      address: { country: 'DK', streetAndNumber: '', postalCode: '', city: '' },
      registrationNumber: '',
      website: '',
      phone: '',
      profileEmail: '',
      connected: false,
      profileCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    record.connected = true;
    record.connectedAt = now;
    record.updatedAt = now;
    this.store.set(merchantId, record);
    this.logger.log({ action: 'markConnected', merchantId });
  }

  updateMollieStatus(merchantId: string, status: OnboardingStatus): void {
    const record = this.getOrThrow(merchantId);
    record.mollieStatus = status.status;
    record.canReceivePayments = status.canReceivePayments;
    record.canReceiveSettlements = status.canReceiveSettlements;
    record.dashboardUrl = status.dashboardUrl;
    record.statusMessage = status.message;
    record.updatedAt = new Date();
    this.store.set(merchantId, record);
  }

  updateCapabilities(merchantId: string, summary: CapabilitiesSummary): void {
    const record = this.getOrThrow(merchantId);
    record.capabilityRequirements = summary.requirements;
    record.capabilitiesSummary = {
      payments: summary.payments,
      settlements: summary.settlements,
    };

    if (summary.payments.enabled) {
      record.canReceivePayments = true;
    }
    if (summary.settlements.enabled) {
      record.canReceiveSettlements = true;
    }

    record.updatedAt = new Date();
    this.store.set(merchantId, record);
    this.logger.log({
      action: 'updateCapabilities',
      merchantId,
      openRequirements: summary.requirements.length,
    });
  }

  updateProfileCount(merchantId: string, count: number): void {
    const record = this.getOrThrow(merchantId);
    record.profileCount = count;
    record.updatedAt = new Date();
    this.store.set(merchantId, record);
  }

  get(merchantId: string): MerchantRecord | undefined {
    return this.store.get(merchantId);
  }

  getOrThrow(merchantId: string): MerchantRecord {
    const record = this.store.get(merchantId);
    if (!record) {
      throw new NotFoundException(`Merchant not found: ${merchantId}`);
    }
    return record;
  }

  listAll(): MerchantRecord[] {
    return [...this.store.values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  listAllWithFlow(): MerchantListItem[] {
    return this.listAll().map(toListItem);
  }

  getWithFlow(merchantId: string): MerchantListItem {
    return toListItem(this.getOrThrow(merchantId));
  }
}
