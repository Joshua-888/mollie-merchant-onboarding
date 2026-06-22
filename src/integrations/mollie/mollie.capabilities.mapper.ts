import {
  MollieCapabilitiesResponseDto,
  MollieCapabilityDto,
  MollieCapabilityRequirementDto,
} from './mollie.types';

export interface CapabilityRequirementItem {
  capability: string;
  capabilityLabel: string;
  requirementId: string;
  label: string;
  status: string;
  dueDate?: string | null;
  dashboardUrl?: string;
}

export interface CapabilitiesSummary {
  payments: { status: string; enabled: boolean };
  settlements: { status: string; enabled: boolean };
  requirements: CapabilityRequirementItem[];
}

const CAPABILITY_LABELS: Record<string, string> = {
  payments: 'Betalinger',
  settlements: 'Udbetalinger',
};

const REQUIREMENT_LABELS: Record<string, string> = {
  'needs-data': 'Yderligere virksomheds- og KYC-oplysninger',
  'process-first-payment': 'Gennemfør første betaling',
  'provide-organisation-details': 'Virksomhedsoplysninger mangler',
  'provide-organization-details': 'Virksomhedsoplysninger mangler',
  'provide-stakeholder-information': 'Ejerstruktur / stakeholders mangler',
  'provide-stakeholders': 'Ejerstruktur / stakeholders mangler',
  'provide-ultimate-beneficial-owner': 'UBO-oplysninger mangler (≥25% ejerskab)',
  'provide-ubo-information': 'UBO-oplysninger mangler (≥25% ejerskab)',
  'upload-identification': 'Identitetsdokument skal uploades',
  'upload-id-document': 'Identitetsdokument skal uploades',
  'verify-identity': 'Identitet skal verificeres',
  'add-bank-account': 'Bankkonto (IBAN) til udbetalinger mangler',
  'provide-bank-account': 'Bankkonto (IBAN) til udbetalinger mangler',
  'verify-bank-account': 'Bankkonto skal verificeres',
};

const OPEN_REQUIREMENT_STATUSES = new Set(['currently-due', 'past-due', 'requested']);

function labelForRequirement(requirementId: string): string {
  if (REQUIREMENT_LABELS[requirementId]) {
    return REQUIREMENT_LABELS[requirementId];
  }
  return requirementId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mapRequirement(
  capability: MollieCapabilityDto,
  requirement: MollieCapabilityRequirementDto,
): CapabilityRequirementItem {
  const capabilityLabel = CAPABILITY_LABELS[capability.name] ?? capability.name;
  const baseLabel = labelForRequirement(requirement.id);

  return {
    capability: capability.name,
    capabilityLabel,
    requirementId: requirement.id,
    label: `${capabilityLabel}: ${baseLabel}`,
    status: requirement.status,
    dueDate: requirement.dueDate,
    dashboardUrl: requirement._links?.dashboard?.href,
  };
}

function isOpenRequirement(requirement: MollieCapabilityRequirementDto): boolean {
  return OPEN_REQUIREMENT_STATUSES.has(requirement.status);
}

export function mapCapabilities(dto: MollieCapabilitiesResponseDto): CapabilitiesSummary {
  const capabilities = dto._embedded?.capabilities ?? [];

  const payments = capabilities.find((c) => c.name === 'payments');
  const settlements = capabilities.find((c) => c.name === 'settlements');

  const requirements = capabilities.flatMap((capability) => {
    if (capability.status === 'enabled') {
      return [];
    }
    return (capability.requirements ?? [])
      .filter(isOpenRequirement)
      .map((req) => mapRequirement(capability, req));
  });

  return {
    payments: {
      status: payments?.status ?? 'unrequested',
      enabled: payments?.status === 'enabled',
    },
    settlements: {
      status: settlements?.status ?? 'unrequested',
      enabled: settlements?.status === 'enabled',
    },
    requirements,
  };
}

export function capabilityRequirementLabels(summary: CapabilitiesSummary): string[] {
  return summary.requirements.map((r) => r.label);
}
