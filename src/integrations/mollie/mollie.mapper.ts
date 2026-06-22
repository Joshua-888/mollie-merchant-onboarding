import {
  MollieOnboardingStatusDto,
  MollieProfileResponseDto,
  MollieTokenResponseDto,
  MerchantProfile,
  OAuthTokens,
  OnboardingStatus,
} from './mollie.types';

const ONBOARDING_STATUS_MESSAGES: Record<
  string,
  Record<string, Record<string, string>>
> = {
  'needs-data': {
    false: {
      false: 'Før du kan modtage betalinger, skal Mollie have flere oplysninger.',
    },
    true: {
      false:
        'Du kan begynde at modtage betalinger. Før Mollie kan udbetale til din bank, skal du angive yderligere oplysninger.',
    },
  },
  'in-review': {
    false: {
      false: 'Mollie har alle nødvendige oplysninger og verificerer dine data.',
    },
    true: {
      false:
        'Du kan begynde at modtage betalinger. Mollie verificerer dine oplysninger for at aktivere udbetalinger til din bank.',
    },
  },
  completed: {
    true: { true: 'Opsætningen er fuldført!' },
  },
};

function resolveOnboardingMessage(
  status: string,
  canReceivePayments: boolean,
  canReceiveSettlements: boolean,
): string {
  const payments = String(canReceivePayments);
  const settlements = String(canReceiveSettlements);
  return (
    ONBOARDING_STATUS_MESSAGES[status]?.[payments]?.[settlements] ??
    'Onboarding er i gang.'
  );
}

export function mapTokenResponse(dto: MollieTokenResponseDto): OAuthTokens {
  return {
    accessToken: dto.access_token,
    refreshToken: dto.refresh_token,
    expiresAt: new Date(Date.now() + dto.expires_in * 1000),
    scope: dto.scope,
  };
}

export function mapOnboardingStatus(dto: MollieOnboardingStatusDto): OnboardingStatus {
  return {
    organizationName: dto.name,
    signedUpAt: new Date(dto.signedUpAt),
    status: dto.status,
    canReceivePayments: dto.canReceivePayments,
    canReceiveSettlements: dto.canReceiveSettlements,
    dashboardUrl: dto._links?.dashboard?.href,
    message: resolveOnboardingMessage(
      dto.status,
      dto.canReceivePayments,
      dto.canReceiveSettlements,
    ),
  };
}

export function mapProfile(dto: MollieProfileResponseDto): MerchantProfile {
  return {
    profileId: dto.id,
    name: dto.name,
    website: dto.website,
    email: dto.email,
    mode: dto.mode,
    status: dto.status,
    createdAt: new Date(dto.createdAt),
  };
}
