export const DK_COUNTRY = 'DK';
export const DK_LOCALE = 'da_DK';

export const DK_PAYMENT_METHODS = [
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
