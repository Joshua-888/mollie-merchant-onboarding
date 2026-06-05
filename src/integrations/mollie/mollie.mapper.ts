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
      false: 'Before you can receive payments, Mollie needs more information.',
    },
    true: {
      false:
        'You can start receiving payments. Before Mollie can pay out to your bank, you need to provide some additional information.',
    },
  },
  'in-review': {
    false: {
      false: 'Mollie has all the required information and is verifying your details.',
    },
    true: {
      false:
        'You can start receiving payments. Mollie is verifying your details to enable settlements to your bank.',
    },
  },
  completed: {
    true: { true: 'Setup is complete!' },
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
    'Onboarding is in progress.'
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
