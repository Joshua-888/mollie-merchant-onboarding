export const DENMARK_COUNTRY_CODE = 'DK';
export const DENMARK_DEFAULT_LOCALE = 'da_DK';
export const DENMARK_CURRENCY = 'DKK';

export interface DanishPaymentMethod {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
}

/** Payment methods commonly used by Danish merchants via Mollie. */
export const DENMARK_PAYMENT_METHODS: DanishPaymentMethod[] = [
  {
    id: 'mobilepay',
    label: 'MobilePay',
    description: 'Den mest brugte betalingsmetode i Danmark',
    recommended: true,
  },
  {
    id: 'creditcard',
    label: 'Visa / Mastercard',
    description: 'Visa og Mastercard',
    recommended: true,
  },
  {
    id: 'applepay',
    label: 'Apple Pay / Google Pay',
    description: 'Hurtig betaling med Apple Pay og Google Pay',
    recommended: true,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    description: 'International digital wallet',
    recommended: false,
  },
  {
    id: 'banktransfer',
    label: 'Bankoverførsel',
    description: 'Manuel bankoverførsel',
    recommended: false,
  },
  {
    id: 'klarna',
    label: 'Klarna',
    description: 'Køb nu, betal senere',
    recommended: false,
  },
];

export const DENMARK_RECOMMENDED_METHOD_IDS = DENMARK_PAYMENT_METHODS.filter(
  (method) => method.recommended,
).map((method) => method.id);

/** Mollie Client Links API — Danish legal entity types. */
export const DENMARK_LEGAL_ENTITIES = [
  { value: 'dk-anpartsselskab', label: 'ApS (Anpartsselskab)' },
  { value: 'dk-aktieselskab', label: 'A/S (Aktieselskab)' },
  { value: 'dk-enkeltmandsvirksomhed', label: 'Enkeltmandsvirksomhed' },
  { value: 'dk-ivaerksaetterselskab', label: 'IVS (Iværksætterselskab)' },
  { value: 'dk-interessentskab', label: 'Interessentskab (I/S)' },
  { value: 'dk-kommanditselskab', label: 'Kommanditselskab (K/S)' },
  { value: 'dk-stiftelse', label: 'Stiftelse' },
  { value: 'dk-trust', label: 'Trust' },
] as const;

export const DENMARK_LEGAL_ENTITY_VALUES = DENMARK_LEGAL_ENTITIES.map((e) => e.value);

export const CVR_PATTERN = /^[0-9]{8}$/;
export const DANISH_VAT_PATTERN = /^DK[0-9]{8}$/;

/** Fields required by Mollie for merchant approval — used for form + validation. */
export const MOLLIE_ONBOARDING_FIELD_GROUPS = {
  owner: {
    title: 'Kontaktperson (ejer / direktør)',
    mollieApi: 'owner',
    fields: [
      { key: 'email', label: 'E-mail', required: true, mollieField: 'owner.email' },
      { key: 'givenName', label: 'Fornavn', required: true, mollieField: 'owner.givenName' },
      { key: 'familyName', label: 'Efternavn', required: true, mollieField: 'owner.familyName' },
      { key: 'locale', label: 'Sprog', required: false, mollieField: 'owner.locale' },
    ],
  },
  organization: {
    title: 'Virksomhed',
    mollieApi: 'organization',
    fields: [
      { key: 'organizationName', label: 'Virksomhedsnavn', required: true, mollieField: 'name' },
      { key: 'legalEntity', label: 'Selskabsform', required: true, mollieField: 'legalEntity' },
      { key: 'registrationNumber', label: 'CVR-nummer', required: true, mollieField: 'registrationNumber' },
      { key: 'vatNumber', label: 'Momsregistreringsnummer', required: false, mollieField: 'vatNumber' },
      { key: 'incorporationDate', label: 'Stiftelsesdato', required: false, mollieField: 'incorporationDate' },
    ],
  },
  address: {
    title: 'Virksomhedsadresse',
    mollieApi: 'address',
    fields: [
      { key: 'streetAndNumber', label: 'Adresse', required: true, mollieField: 'address.streetAndNumber' },
      { key: 'postalCode', label: 'Postnummer', required: true, mollieField: 'address.postalCode' },
      { key: 'city', label: 'By', required: true, mollieField: 'address.city' },
      { key: 'country', label: 'Land', required: true, mollieField: 'address.country' },
    ],
  },
  profile: {
    title: 'Betalingsprofil (website)',
    mollieApi: 'profile',
    note: 'Kræves af Mollie for at modtage betalinger på restaurantens website.',
    fields: [
      { key: 'website', label: 'Website URL', required: true, mollieField: 'profile.website' },
      { key: 'phone', label: 'Telefon', required: true, mollieField: 'profile.phone' },
      { key: 'profileEmail', label: 'Kontakt e-mail (profil)', required: true, mollieField: 'profile.email' },
      { key: 'businessDescription', label: 'Beskrivelse af forretning', required: false, mollieField: 'profile.description' },
    ],
  },
  mollieWizard: {
    title: 'Bekræftes hos Mollie efter godkendelse',
    mollieApi: 'dashboard',
    note: 'Oplysninger indsamles lokalt til forudvalidering, men identitet, UBO og bank skal stadig bekræftes i Mollie.',
    fields: [
      { key: 'bankAccount', label: 'Bankkonto til udbetalinger', required: true, mollieField: 'settlements' },
      { key: 'identity', label: 'Identitetsverificering (KYC)', required: true, mollieField: 'kyc' },
      { key: 'ubo', label: 'Reelle ejere (UBO)', required: true, mollieField: 'ubo' },
    ],
  },
  localKyc: {
    title: 'Indsamles i Takeawayhero-formularen',
    fields: [
      { key: 'identity', label: 'Identitetsdokument (metadata + fil)', required: true },
      { key: 'ubo', label: 'Reelle ejere (UBO)', required: true },
      { key: 'bankAccount', label: 'Bankkonto (IBAN)', required: true },
    ],
  },
} as const;
