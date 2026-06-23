import { DENMARK_COUNTRY_CODE } from '../../config/denmark.config';
import {
  CvrAddressDetailsDto,
  CvrCompanyResponseDto,
  CvrCompanySummary,
  CvrOwnerDto,
  CvrSearchResultDto,
  CvrSuggestedOwner,
  CvrSuggestedUbo,
  CvrSuggestion,
  CvrSuggestionDto,
} from './cvr.types';

const COMPANY_CODE_TO_LEGAL_ENTITY: Record<number, string> = {
  10: 'dk-enkeltmandsvirksomhed',
  15: 'dk-enkeltmandsvirksomhed',
  30: 'dk-interessentskab',
  40: 'dk-kommanditselskab',
  60: 'dk-aktieselskab',
  70: 'dk-interessentskab',
  80: 'dk-aktieselskab',
  100: 'dk-kommanditselskab',
  110: 'dk-stiftelse',
  115: 'dk-stiftelse',
  130: 'dk-ivaerksaetterselskab',
  140: 'dk-anpartsselskab',
};

const COMPANY_DESC_TO_LEGAL_ENTITY: [RegExp, string][] = [
  [/anpartsselskab|\baps\b/i, 'dk-anpartsselskab'],
  [/aktieselskab|a\/s\b/i, 'dk-aktieselskab'],
  [/enkeltmandsvirksomhed/i, 'dk-enkeltmandsvirksomhed'],
  [/iværksætterselskab|ivaerksaetterselskab|\bivs\b/i, 'dk-ivaerksaetterselskab'],
  [/interessentskab|i\/s\b/i, 'dk-interessentskab'],
  [/kommanditselskab|k\/s\b/i, 'dk-kommanditselskab'],
  [/stiftelse|\bfond\b/i, 'dk-stiftelse'],
];

const VAT_LIABLE_LEGAL_ENTITIES = new Set([
  'dk-anpartsselskab',
  'dk-aktieselskab',
  'dk-ivaerksaetterselskab',
  'dk-interessentskab',
  'dk-kommanditselskab',
]);

const CORPORATE_NAME_PATTERN =
  /\b(anpartsselskab|aktieselskab|interessentskab|kommanditselskab|enkeltmandsvirksomhed|holding|amba|forening|fond|s\.?m\.?b\.?a|sce|s\.?e\.?)\b|(\baps\b|\ba\/s\b|\bi\/s\b|\bk\/s\b|\bivs\b)/i;

const UBO_THRESHOLD_PERCENT = 25;

export function mapLegalEntity(companycode?: number, companydesc?: string): string | undefined {
  if (companycode != null && COMPANY_CODE_TO_LEGAL_ENTITY[companycode]) {
    return COMPANY_CODE_TO_LEGAL_ENTITY[companycode];
  }
  if (companydesc) {
    for (const [pattern, value] of COMPANY_DESC_TO_LEGAL_ENTITY) {
      if (pattern.test(companydesc)) return value;
    }
  }
  return undefined;
}

export function parseIncorporationDate(startdate?: string | null): string | undefined {
  if (!startdate) return undefined;

  const isoMatch = startdate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const legacyMatch = startdate.match(/(\d{2})\/(\d{2})\s*-\s*(\d{4})/);
  if (legacyMatch) {
    return `${legacyMatch[3]}-${legacyMatch[2]}-${legacyMatch[1]}`;
  }

  return undefined;
}

export function splitPersonName(fullName: string): { givenName: string; familyName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: '', familyName: '' };
  if (parts.length === 1) return { givenName: parts[0], familyName: parts[0] };
  return { givenName: parts[0], familyName: parts.slice(1).join(' ') };
}

export function isCorporateName(name: string): boolean {
  return CORPORATE_NAME_PATTERN.test(name);
}

export function normalizePostalCode(zipcode?: string | number | null): string {
  const digits = String(zipcode ?? '').replace(/\D/g, '');
  if (digits.length === 4) return digits;
  if (digits.length > 4) return digits.slice(-4);
  return digits;
}

export function formatStreetAddress(
  address?: string | null,
  addressDetails?: CvrAddressDetailsDto | null,
): string {
  if (addressDetails) {
    const streetLine = [addressDetails.street, addressDetails.house_number].filter(Boolean).join(' ').trim();
    if (streetLine) {
      let formatted = streetLine;
      if (addressDetails.floor) {
        formatted += `, ${addressDetails.floor}.`;
      }
      if (addressDetails.door) {
        formatted += ` ${addressDetails.door}`;
      }
      return formatted.trim();
    }
  }

  return address?.trim() ?? '';
}

export function formatPhoneForMollie(phone?: string | null): string | undefined {
  if (!phone?.trim()) return undefined;

  const digits = phone.replace(/\D/g, '');
  let national = digits;

  if (national.startsWith('45') && national.length >= 10) {
    national = national.slice(2);
  }

  if (national.length === 8) {
    return `+45 ${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)}`;
  }

  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }

  return phone.trim();
}

export function normalizeWebsite(website?: string | null): string | undefined {
  if (!website?.trim()) return undefined;
  const value = website.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function truncateDescription(description?: string | null, maxLength = 500): string | undefined {
  if (!description?.trim()) return undefined;
  const trimmed = description.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function inferVatNumber(
  cvr: string,
  legalEntity?: string,
  vatRegistered?: boolean | null,
): string | undefined {
  if (vatRegistered === false) return undefined;
  if (vatRegistered === true) return `DK${cvr}`;
  if (legalEntity && VAT_LIABLE_LEGAL_ENTITIES.has(legalEntity)) return `DK${cvr}`;
  return undefined;
}

function isDirectorRole(owner: CvrOwnerDto): boolean {
  return /direktion|daglig leder|administrerende|bestyrelse|ceo|director/i.test(
    `${owner.role ?? ''} ${owner.title ?? ''}`,
  );
}

function mapOwnerRole(owner: CvrOwnerDto): string | undefined {
  const title = owner.title?.trim();
  if (title) return title;

  switch ((owner.role ?? '').toUpperCase()) {
    case 'DIREKTION':
      return 'Direktør';
    case 'BESTYRELSE':
      return 'Bestyrelsesmedlem';
    case 'REEL EJER':
      return 'Reel ejer';
    case 'STIFTER':
      return 'Stifter';
    default:
      return owner.role?.trim() || undefined;
  }
}

function activePersonOwners(owners?: CvrOwnerDto[] | null): CvrOwnerDto[] {
  return (owners ?? []).filter(
    (owner) => owner.active !== false && owner.name?.trim() && !isCorporateName(owner.name),
  );
}

export function mapSuggestedOwner(
  dto: Pick<CvrCompanyResponseDto, 'owners' | 'addressco' | 'email' | 'name'>,
  legalEntity?: string,
): CvrSuggestedOwner | undefined {
  const email = dto.email?.trim() || undefined;

  if (legalEntity === 'dk-enkeltmandsvirksomhed') {
    const ownerName = dto.addressco?.trim() || activePersonOwners(dto.owners)[0]?.name?.trim();
    if (ownerName && !isCorporateName(ownerName)) {
      const { givenName, familyName } = splitPersonName(ownerName);
      if (givenName) return { givenName, familyName, email };
    }
  }

  const directors = activePersonOwners(dto.owners).filter(isDirectorRole);
  if (directors.length) {
    const { givenName, familyName } = splitPersonName(directors[0].name!);
    if (givenName) return { givenName, familyName, email };
  }

  const ownersByShare = [...activePersonOwners(dto.owners)].sort(
    (a, b) => (b.share ?? 0) - (a.share ?? 0),
  );
  if (ownersByShare.length) {
    const { givenName, familyName } = splitPersonName(ownersByShare[0].name!);
    if (givenName) return { givenName, familyName, email };
  }

  return undefined;
}

export function mapSuggestedUbos(
  owners?: CvrOwnerDto[] | null,
  legalEntity?: string,
): CvrSuggestedUbo[] {
  const personOwners = activePersonOwners(owners);
  if (!personOwners.length) return [];

  if (legalEntity === 'dk-enkeltmandsvirksomhed') {
    const owner = personOwners[0];
    const { givenName, familyName } = splitPersonName(owner.name!);
    if (!givenName) return [];

    return [
      {
        givenName,
        familyName,
        nationality: DENMARK_COUNTRY_CODE,
        ownershipPercent: 100,
        isPseudoUbo: false,
        role: mapOwnerRole(owner) ?? 'Ejer',
      },
    ];
  }

  const ubos: CvrSuggestedUbo[] = [];
  const seen = new Set<string>();

  for (const owner of personOwners) {
    const share = owner.share ?? 0;
    const director = isDirectorRole(owner);
    if (share < UBO_THRESHOLD_PERCENT && !director) continue;

    const { givenName, familyName } = splitPersonName(owner.name!);
    const key = `${givenName}|${familyName}`.toLowerCase();
    if (!givenName || !familyName || seen.has(key)) continue;
    seen.add(key);

    ubos.push({
      givenName,
      familyName,
      nationality: DENMARK_COUNTRY_CODE,
      ownershipPercent: director && share < UBO_THRESHOLD_PERCENT ? 0 : Math.round(share),
      isPseudoUbo: director && share < UBO_THRESHOLD_PERCENT,
      role: mapOwnerRole(owner),
    });
  }

  return ubos;
}

export function mapCompanyDto(dto: CvrCompanyResponseDto | CvrSearchResultDto): CvrCompanySummary {
  const cvr = String(dto.vat).padStart(8, '0');
  const legalEntity = mapLegalEntity(dto.companycode, dto.companydesc);
  const addressDetails = 'address_details' in dto ? dto.address_details : undefined;
  const addressco = 'addressco' in dto ? dto.addressco : undefined;
  const vatRegistered = 'vatregistered' in dto ? dto.vatregistered : undefined;

  const owners =
    'owners' in dto && dto.owners?.length
      ? dto.owners
      : addressco
        ? [{ name: addressco, active: true }]
        : undefined;

  const suggestedOwner = mapSuggestedOwner(
    {
      name: dto.name,
      email: dto.email,
      addressco,
      owners,
    },
    legalEntity,
  );

  return {
    cvr,
    name: dto.name.trim(),
    legalEntity,
    legalEntityLabel: dto.companydesc,
    vatNumber: inferVatNumber(cvr, legalEntity, vatRegistered),
    incorporationDate: parseIncorporationDate(dto.startdate),
    address: {
      streetAndNumber: formatStreetAddress(dto.address, addressDetails),
      postalCode: normalizePostalCode(addressDetails?.zipcode ?? dto.zipcode),
      city: (addressDetails?.city ?? dto.city ?? '').trim(),
      country: DENMARK_COUNTRY_CODE,
    },
    phone: formatPhoneForMollie(dto.phone),
    email: dto.email?.trim() || undefined,
    website: normalizeWebsite(dto.website),
    industryDescription: truncateDescription(dto.industrydesc),
    status: 'companystatus' in dto && dto.companystatus ? dto.companystatus : undefined,
    suggestedOwner,
    suggestedUbos: mapSuggestedUbos(owners, legalEntity),
    bankAccountHolder: dto.name.trim(),
  };
}

export function mapSuggestionDto(dto: CvrSuggestionDto): CvrSuggestion {
  return {
    cvr: String(dto.vat).padStart(8, '0'),
    name: dto.name,
    addressLine: dto.address,
  };
}
