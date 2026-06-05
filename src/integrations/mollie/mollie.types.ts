// ─── Mollie API DTOs (raw shapes from the Mollie API) ─────────────────────────

export interface MollieOwnerDto {
  email: string;
  givenName: string;
  familyName: string;
  locale?: string | null;
}

export interface MollieAddressDto {
  streetAndNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country: string;
}

export interface MollieClientLinkRequestDto {
  owner: MollieOwnerDto;
  name?: string;
  address?: MollieAddressDto;
  registrationNumber?: string | null;
  vatNumber?: string | null;
}

export interface MollieClientLinkResponseDto {
  resource: 'client-link';
  id: string;
  clientLink: string;
  _links: {
    clientLink: { href: string; type: string };
    documentation: { href: string; type: string };
  };
}

export interface MollieTokenResponseDto {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token: string;
}

export interface MollieOnboardingStatusDto {
  resource: 'onboarding';
  name: string;
  signedUpAt: string;
  status: 'needs-data' | 'in-review' | 'completed';
  canReceivePayments: boolean;
  canReceiveSettlements: boolean;
  _links: {
    self: { href: string; type: string };
    dashboard?: { href: string; type: string };
    organization?: { href: string; type: string };
    documentation?: { href: string; type: string };
  };
}

export interface MollieProfileRequestDto {
  name: string;
  website: string;
  email: string;
  phone?: string;
  categoryCode?: number;
  mode?: 'live' | 'test';
}

export interface MollieProfileResponseDto {
  resource: 'profile';
  id: string;
  mode: 'live' | 'test';
  name: string;
  website: string;
  email: string;
  phone?: string;
  status: 'unverified' | 'verified' | 'blocked';
  createdAt: string;
  _links: {
    self: { href: string; type: string };
    dashboard?: { href: string; type: string };
    checkoutPreviewUrl?: { href: string; type: string };
    documentation: { href: string; type: string };
  };
}

export interface MolliePaymentMethodDto {
  resource: 'method';
  id: string;
  description: string;
  status?: string;
  image: {
    size1x: string;
    size2x: string;
    svg: string;
  };
}

export interface MollieErrorDto {
  status: number;
  title: string;
  detail: string;
  field?: string;
  _links?: {
    documentation?: { href: string; type: string };
  };
}

// ─── Internal domain models ────────────────────────────────────────────────────

export interface MerchantOwner {
  email: string;
  givenName: string;
  familyName: string;
  locale?: string;
}

export interface MerchantAddress {
  streetAndNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
}

export interface ClientLinkResult {
  clientLinkId: string;
  redirectUrl: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface OnboardingStatus {
  organizationName: string;
  signedUpAt: Date;
  status: 'needs-data' | 'in-review' | 'completed';
  canReceivePayments: boolean;
  canReceiveSettlements: boolean;
  dashboardUrl?: string;
  message: string;
}

export interface MerchantProfile {
  profileId: string;
  name: string;
  website: string;
  email: string;
  mode: 'live' | 'test';
  status: 'unverified' | 'verified' | 'blocked';
  createdAt: Date;
}
