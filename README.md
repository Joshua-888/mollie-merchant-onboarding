# Mollie Merchant Onboarding — Danmark

NestJS-tjeneste der automatiserer onboarding af nye Takeawayhero-merchants på Mollie betalingsplatformen, tilpasset **danske virksomheder** med lokale betalingsmetoder (MobilePay, Visa / Mastercard, Apple Pay / Google Pay m.fl.).

## Overview

Denne service implementerer [Mollie Connect for Platforms](https://docs.mollie.com/docs/connect-platforms-onboarding-customers) onboarding-flowet for Danmark:

1. **Initiate** — Opretter et Mollie Client Link med danske virksomhedsdata (CVR, adresse, moms) + lokal KYC (identitet, UBO, bank).
2. **Callback** — Håndterer OAuth redirect og gemmer access/refresh tokens.
3. **Status / Capabilities** — Følger onboarding og viser præcise Mollie-krav med dashboard deep links.
4. **Profiles** — Opretter betalingsprofil for merchantens website.
5. **Methods** — Aktiverer danske betalingsmetoder på profilen.

### Lokal KYC vs. Mollie

| Data | Indsamles i Takeawayhero | Sendes til Mollie via API |
|---|---|---|
| Kontaktperson, virksomhed, adresse, profil | ✅ | ✅ (Client Links) |
| Identitet, UBO, bankkonto | ✅ (valideres lokalt) | ❌ (merchant bekræfter i Mollie-dashboard) |
| ID-dokument (fil) | ✅ (`uploads/kyc/`) | ❌ |

### Understøttede danske betalingsmetoder

| Metode | Mollie ID | Anbefalet |
|---|---|---|
| MobilePay | `mobilepay` | ★ |
| Visa / Mastercard | `creditcard` | ★ |
| Apple Pay / Google Pay | `applepay` | ★ |
| PayPal | `paypal` | |
| Bankoverførsel | `banktransfer` | |
| Klarna | `klarna` | |

> MobilePay kræver dansk virksomhed og kan kræve separat MobilePay-aftale hos Mollie.

---

## Prerequisites

- Node.js 20+
- [Mollie Partner-konto](https://www.mollie.com/dk/partners) med OAuth-applikation
- Advanced Access Token med `clients.write` scope

---

## Setup

```bash
npm install
cp .env.example .env
```

### Environment variables

| Variable | Description |
|---|---|
| `MOLLIE_CLIENT_ID` | OAuth app client ID (`app_...`) |
| `MOLLIE_CLIENT_SECRET` | OAuth app client secret |
| `MOLLIE_ACCESS_TOKEN` | Advanced token med `clients.write` |
| `MOLLIE_REDIRECT_URI` | OAuth callback URL |
| `APP_BASE_URL` | Base URL for denne service |

---

## Running

```bash
npm run start:dev
```

| Side | URL |
|---|---|
| **Onboarding formular** | http://localhost:3000/index.html |
| **Merchant oversigt** | http://localhost:3000/merchants.html |
| **Dashboard** | http://localhost:3000/dashboard.html |

### Lokal Mollie-opsætning

1. Opret OAuth app på [Mollie Developers](https://my.mollie.com/dashboard/developers/applications)
2. Sæt redirect URI til `http://localhost:3000/api/v1/onboarding/callback`
3. Opret Advanced Access Token med `clients.write`
4. Udfyld `.env` med dine credentials

---

## API Endpoints

### Initiate onboarding (dansk merchant + lokal KYC)

```
POST /api/v1/onboarding/initiate
```

```json
{
  "merchantId": "dk-restaurant-001",
  "email": "ejer@restaurant.dk",
  "givenName": "Lars",
  "familyName": "Nielsen",
  "locale": "da_DK",
  "organizationName": "Restaurant Sørensen ApS",
  "legalEntity": "dk-anpartsselskab",
  "address": {
    "streetAndNumber": "Nørregade 10",
    "postalCode": "2100",
    "city": "København",
    "country": "DK"
  },
  "registrationNumber": "12345678",
  "vatNumber": "DK12345678",
  "website": "https://restaurant.dk",
  "phone": "+4512345678",
  "profileEmail": "betaling@restaurant.dk",
  "localKyc": {
    "identity": {
      "documentType": "passport",
      "documentNumber": "AB1234567",
      "issuingCountry": "DK",
      "dateOfBirth": "1985-06-15",
      "nationality": "DK",
      "expiryDate": "2030-01-01"
    },
    "ubos": [
      {
        "givenName": "Lars",
        "familyName": "Nielsen",
        "dateOfBirth": "1985-06-15",
        "nationality": "DK",
        "ownershipPercent": 100,
        "isPseudoUbo": false,
        "role": "Direktør"
      }
    ],
    "bankAccount": {
      "accountHolderName": "Restaurant Sørensen ApS",
      "iban": "DK5000400440116243"
    }
  }
}
```

### Upload ID-dokument (efter initiate)

```
POST /api/v1/onboarding/merchants/:merchantId/kyc-documents
Content-Type: multipart/form-data
```

Felter: `idDocumentFront` (påkrævet), `idDocumentBack` (valgfri). JPEG, PNG eller PDF — max 5 MB.

### Capabilities (Mollie-krav med deep links)

```
GET /api/v1/onboarding/capabilities/:merchantId
```

### Merchant oversigt

```
GET /api/v1/onboarding/merchants
GET /api/v1/onboarding/merchants?sync=true
GET /api/v1/onboarding/merchants/:merchantId
POST /api/v1/onboarding/merchants/sync
POST /api/v1/onboarding/merchants/:merchantId/sync
```

Returnerer merchants med statusflow, lokal KYC-summary, progress og manglende Mollie-krav.

### Betalingsmetoder

```
GET /api/v1/onboarding/payment-methods
```

### Aktiver betalingsmetode

```
POST /api/v1/onboarding/profiles/:profileId/methods/mobilepay?merchantId=...
```

---

## Testing

```bash
npm test
npm run build
```

---

## Architecture

```
src/
├── config/denmark.config.ts       # Danske defaults og betalingsmetoder
├── onboarding/
│   ├── dto/kyc.dto.ts             # Lokal KYC DTOs
│   ├── kyc-validation.ts          # IBAN, UBO, identitet validering
│   └── kyc-document.storage.ts    # Fil-upload (uploads/kyc/)
├── integrations/mollie/           # Mollie client, capabilities mapper
└── merchants/                     # Registry, flow, token store
public/
├── index.html                     # Onboarding + lokal KYC formular
├── merchants.html                 # Oversigt med Mollie-krav
├── dashboard.html                 # Status, lokal KYC, profiler
└── js/dk-config.js                # Frontend konfiguration
```
