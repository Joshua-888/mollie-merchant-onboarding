/** Raw suggestion item from DataCVR `/dk/suggestions/company/{query}`. */
export interface CvrSuggestionDto {
  vat: number;
  name: string;
  address: string;
}

export interface CvrSuggestionsResponseDto {
  suggestions: CvrSuggestionDto[];
}

export interface CvrAddressDetailsDto {
  street?: string;
  house_number?: string;
  floor?: string | null;
  door?: string | null;
  co_name?: string | null;
  zipcode?: string;
  city?: string;
  country?: string;
}

export interface CvrSearchResultDto {
  vat: number;
  name: string;
  address?: string;
  address_details?: CvrAddressDetailsDto | null;
  zipcode?: string;
  city?: string;
  companycode?: number;
  companydesc?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  startdate?: string | null;
  industrydesc?: string | null;
  companystatus?: string | null;
  vatregistered?: boolean | null;
}

export interface CvrSearchResponseDto {
  total: number;
  limit: number;
  offset: number;
  results: CvrSearchResultDto[];
}

export interface CvrOwnerDto {
  name?: string;
  role?: string;
  title?: string;
  share?: number | null;
  active?: boolean;
}

export interface CvrCompanyResponseDto {
  vat: number;
  name: string;
  address?: string;
  address_details?: CvrAddressDetailsDto | null;
  addressco?: string | null;
  zipcode?: string;
  city?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  startdate?: string | null;
  industrycode?: number;
  industrydesc?: string | null;
  companycode?: number;
  companydesc?: string;
  companystatus?: string;
  vatregistered?: boolean | null;
  owners?: CvrOwnerDto[] | null;
}

/** Normalized company data mapped to Mollie onboarding form fields. */
export interface CvrCompanySummary {
  cvr: string;
  name: string;
  legalEntity?: string;
  legalEntityLabel?: string;
  vatNumber?: string;
  incorporationDate?: string;
  address: {
    streetAndNumber: string;
    postalCode: string;
    city: string;
    country: string;
  };
  phone?: string;
  email?: string;
  website?: string;
  industryDescription?: string;
  status?: string;
  suggestedOwner?: CvrSuggestedOwner;
  suggestedUbos?: CvrSuggestedUbo[];
  bankAccountHolder?: string;
}

export interface CvrSuggestedOwner {
  givenName: string;
  familyName: string;
  email?: string;
}

export interface CvrSuggestedUbo {
  givenName: string;
  familyName: string;
  nationality?: string;
  ownershipPercent?: number;
  role?: string;
  isPseudoUbo?: boolean;
}

export interface CvrSuggestion {
  cvr: string;
  name: string;
  addressLine: string;
}
