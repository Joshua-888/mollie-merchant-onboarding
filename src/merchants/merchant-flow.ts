import { InitiateOnboardingDto } from '../onboarding/dto/initiate-onboarding.dto';
import { CapabilityRequirementItem } from '../integrations/mollie/mollie.capabilities.mapper';
import {
  buildLocalKycSummary,
  LocalKycSummary,
  MerchantLocalKycSnapshot,
} from '../onboarding/kyc-validation';

export type { CapabilityRequirementItem, LocalKycSummary, MerchantLocalKycSnapshot };

export type MollieOnboardingStatus = 'needs-data' | 'in-review' | 'completed';

export interface CapabilitiesSummarySnapshot {
  payments: { status: string; enabled: boolean };
  settlements: { status: string; enabled: boolean };
}

export interface MerchantAddress {
  streetAndNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
}

export interface MerchantRecord {
  merchantId: string;
  email: string;
  givenName: string;
  familyName: string;
  organizationName: string;
  legalEntity: string;
  address: MerchantAddress;
  registrationNumber: string;
  vatNumber?: string;
  incorporationDate?: string;
  website: string;
  phone: string;
  profileEmail: string;
  businessDescription?: string;
  clientLinkId?: string;
  connected: boolean;
  mollieStatus?: MollieOnboardingStatus;
  canReceivePayments?: boolean;
  canReceiveSettlements?: boolean;
  dashboardUrl?: string;
  statusMessage?: string;
  profileCount: number;
  capabilityRequirements?: CapabilityRequirementItem[];
  capabilitiesSummary?: CapabilitiesSummarySnapshot;
  localKyc?: MerchantLocalKycSnapshot;
  createdAt: Date;
  updatedAt: Date;
  connectedAt?: Date;
}

export interface FlowStage {
  key: string;
  label: string;
  state: 'completed' | 'current' | 'pending' | 'blocked';
  description?: string;
}

export interface MerchantListItem extends MerchantRecord {
  missingItems: string[];
  flowStages: FlowStage[];
  progressPercent: number;
  localKycSummary?: LocalKycSummary;
}

const SUBMISSION_FIELDS: { key: keyof MerchantRecord | string; label: string }[] = [
  { key: 'organizationName', label: 'Virksomhedsnavn' },
  { key: 'legalEntity', label: 'Selskabsform' },
  { key: 'registrationNumber', label: 'CVR-nummer' },
  { key: 'address.streetAndNumber', label: 'Adresse' },
  { key: 'address.postalCode', label: 'Postnummer' },
  { key: 'address.city', label: 'By' },
  { key: 'website', label: 'Website URL' },
  { key: 'phone', label: 'Telefon' },
  { key: 'profileEmail', label: 'Kontakt e-mail (profil)' },
];

function getNestedValue(record: MerchantRecord, path: string): unknown {
  if (path.startsWith('address.')) {
    return record.address?.[path.split('.')[1] as keyof MerchantAddress];
  }
  return record[path as keyof MerchantRecord];
}

export function computeMissingSubmissionFields(record: MerchantRecord): string[] {
  return SUBMISSION_FIELDS.filter(({ key }) => !getNestedValue(record, key)).map(({ label }) => label);
}

export function computeMissingItems(
  record: MerchantRecord,
  submissionMissing: string[],
): string[] {
  const items = [...submissionMissing];

  if (!record.connected) {
    items.push('Merchant skal godkende via Mollie-link');
    return items;
  }

  if (record.capabilityRequirements?.length) {
    for (const req of record.capabilityRequirements) {
      if (record.localKyc && isLocallyCollectedForRequirement(req.requirementId, record.localKyc)) {
        items.push(`${req.label} (indsamlet — bekræft hos Mollie)`);
      } else {
        items.push(req.label);
      }
    }
  } else {
    if (record.mollieStatus === 'needs-data') {
      items.push('Mollie kræver yderligere KYC-oplysninger');
    }

    if (record.mollieStatus === 'in-review' && !record.canReceivePayments) {
      items.push('Mollie verificerer virksomhedsoplysninger');
    }

    if (record.canReceivePayments && !record.canReceiveSettlements) {
      items.push('Bankkonto til udbetalinger (udfyldes hos Mollie)');
    }
  }

  if (record.connected && record.mollieStatus === 'completed' && record.profileCount === 0) {
    items.push('Betalingsprofil mangler');
  }

  return [...new Set(items)];
}

const REQUIREMENT_LOCAL_KYC_MAP: Record<string, keyof Pick<MerchantLocalKycSnapshot, 'identity' | 'ubos' | 'bankAccount'>> = {
  'upload-identification': 'identity',
  'upload-id-document': 'identity',
  'verify-identity': 'identity',
  'provide-stakeholder-information': 'ubos',
  'provide-stakeholders': 'ubos',
  'provide-ultimate-beneficial-owner': 'ubos',
  'provide-ubo-information': 'ubos',
  'add-bank-account': 'bankAccount',
  'provide-bank-account': 'bankAccount',
  'verify-bank-account': 'bankAccount',
};

function isLocallyCollectedForRequirement(
  requirementId: string,
  localKyc: MerchantLocalKycSnapshot,
): boolean {
  const field = REQUIREMENT_LOCAL_KYC_MAP[requirementId];
  if (!field) return false;
  if (field === 'ubos') return localKyc.ubos.length > 0;
  return Boolean(localKyc[field]);
}

export function buildFlowStages(record: MerchantRecord): FlowStage[] {
  const submitted = Boolean(record.clientLinkId);
  const authorized = record.connected;
  const kycComplete = record.mollieStatus === 'completed' || record.mollieStatus === 'in-review';
  const kycInProgress = record.mollieStatus === 'needs-data' || record.mollieStatus === 'in-review';
  const paymentsReady = Boolean(record.canReceivePayments);
  const settlementsReady = Boolean(record.canReceiveSettlements);

  const stages: Omit<FlowStage, 'state'>[] = [
    { key: 'submitted', label: 'Sendt til Mollie', description: 'Oplysninger overført til Mollie' },
    { key: 'authorized', label: 'Godkendt', description: 'Merchant har godkendt Takeawayhero' },
    { key: 'kyc', label: 'KYC / Verificering', description: 'Mollie verificerer virksomheden' },
    { key: 'payments', label: 'Betalinger aktiv', description: 'Kan modtage betalinger' },
    { key: 'settlements', label: 'Udbetalinger aktiv', description: 'Kan modtage udbetalinger' },
  ];

  const completedFlags = [submitted, authorized, kycComplete, paymentsReady, settlementsReady];

  let currentIndex = completedFlags.findIndex((done, i) => !done);
  if (currentIndex === -1) currentIndex = stages.length;

  return stages.map((stage, index) => {
    let state: FlowStage['state'] = 'pending';

    if (completedFlags[index]) {
      state = 'completed';
    } else if (index === currentIndex) {
      if (stage.key === 'kyc' && record.mollieStatus === 'needs-data') {
        state = 'blocked';
      } else {
        state = 'current';
      }
    } else if (index < currentIndex) {
      state = 'completed';
    }

    if (stage.key === 'kyc' && kycInProgress && !kycComplete) {
      state = record.mollieStatus === 'needs-data' ? 'blocked' : 'current';
    }

    return { ...stage, state };
  });
}

export function computeProgressPercent(flowStages: FlowStage[]): number {
  const completed = flowStages.filter((s) => s.state === 'completed').length;
  return Math.round((completed / flowStages.length) * 100);
}

export function toListItem(record: MerchantRecord): MerchantListItem {
  const submissionMissing = computeMissingSubmissionFields(record);
  const missingItems = computeMissingItems(record, submissionMissing);
  const flowStages = buildFlowStages(record);

  return {
    ...record,
    missingItems,
    flowStages,
    progressPercent: computeProgressPercent(flowStages),
    localKycSummary: buildLocalKycSummary(record.localKyc),
  };
}

export function recordFromInitiateDto(
  dto: InitiateOnboardingDto,
  clientLinkId: string,
  localKyc?: MerchantLocalKycSnapshot,
): MerchantRecord {
  const now = new Date();
  return {
    merchantId: dto.merchantId,
    email: dto.email,
    givenName: dto.givenName,
    familyName: dto.familyName,
    organizationName: dto.organizationName,
    legalEntity: dto.legalEntity,
    address: {
      streetAndNumber: dto.address.streetAndNumber,
      postalCode: dto.address.postalCode,
      city: dto.address.city,
      country: dto.address.country,
    },
    registrationNumber: dto.registrationNumber,
    vatNumber: dto.vatNumber,
    incorporationDate: dto.incorporationDate,
    website: dto.website,
    phone: dto.phone,
    profileEmail: dto.profileEmail ?? dto.email,
    businessDescription: dto.businessDescription,
    localKyc,
    clientLinkId,
    connected: false,
    profileCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}
