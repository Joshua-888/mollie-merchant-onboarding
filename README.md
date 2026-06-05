# Mollie Merchant Onboarding

A NestJS service that automates the onboarding of new Takeawayhero merchants onto the Mollie payment platform.

## Overview

This service implements the [Mollie Connect for Platforms](https://docs.mollie.com/docs/connect-platforms-onboarding-customers) onboarding flow:

1. **Initiate** — Creates a Mollie Client Link prefilled with merchant business data. The merchant is redirected to Mollie to authorize your platform.
2. **Callback** — Handles the OAuth redirect, exchanges the authorization code for an access + refresh token.
3. **Status** — Polls the merchant's onboarding progress (`needs-data` → `in-review` → `completed`).
4. **Profiles** — Creates a payment profile (storefront) for the merchant.
5. **Methods** — Enables specific payment methods (iDEAL, credit card, Bancontact, etc.) on the profile.

---

## Prerequisites

- Node.js 20+
- A [Mollie Partner account](https://www.mollie.com/en/partners) with an OAuth application registered
- An Advanced Access Token with `clients.write` scope

---

## Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env
```

### Required environment variables

| Variable | Description |
|---|---|
| `MOLLIE_CLIENT_ID` | Your OAuth app's client ID (starts with `app_`) |
| `MOLLIE_CLIENT_SECRET` | Your OAuth app's client secret |
| `MOLLIE_ACCESS_TOKEN` | Advanced access token with `clients.write` scope |
| `MOLLIE_REDIRECT_URI` | OAuth callback URL (must match your Mollie app settings) |
| `APP_BASE_URL` | Base URL of this service |

---

## Running

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

---

## API Endpoints

### 1. Initiate onboarding

```
POST /api/v1/onboarding/initiate
```

**Body:**
```json
{
  "merchantId": "your-internal-merchant-id",
  "email": "owner@restaurant.nl",
  "givenName": "Jan",
  "familyName": "de Vries",
  "organizationName": "Restaurant De Vries",
  "address": {
    "streetAndNumber": "Hoofdstraat 1",
    "postalCode": "1234AB",
    "city": "Amsterdam",
    "country": "NL"
  },
  "registrationNumber": "12345678",
  "vatNumber": "NL123456789B01"
}
```

**Response:** Contains a `redirectUrl` — send the merchant to this URL.

---

### 2. OAuth callback (called by Mollie)

```
GET /api/v1/onboarding/callback?code=...&state=...
```

Mollie redirects the merchant here after authorization. The service exchanges the code for tokens.

---

### 3. Get onboarding status

```
GET /api/v1/onboarding/status/:merchantId
```

Returns the current status and a user-friendly message.

| Status | canReceivePayments | canReceiveSettlements | Action |
|---|---|---|---|
| `needs-data` | false | false | Show dashboard link for merchant to complete profile |
| `needs-data` | true | false | Payments live; prompt for settlement info |
| `in-review` | false | false | Awaiting Mollie review |
| `in-review` | true | false | Payments live; awaiting settlement review |
| `completed` | true | true | Fully live |

---

### 4. Create a payment profile

```
POST /api/v1/onboarding/profiles
```

```json
{
  "merchantId": "your-internal-merchant-id",
  "name": "Restaurant De Vries",
  "website": "https://restaurant-devries.nl",
  "email": "payments@restaurant-devries.nl"
}
```

---

### 5. Enable a payment method

```
POST /api/v1/onboarding/profiles/:profileId/methods/:methodId?merchantId=...
```

Common `methodId` values: `ideal`, `creditcard`, `bancontact`, `paypal`, `applepay`, `banktransfer`

---

### 6. List payment methods

```
GET /api/v1/onboarding/profiles/:profileId/methods?merchantId=...
```

---

## Testing

```bash
# Unit tests
npm test

# With coverage
npm run test:cov
```

---

## Architecture

```
src/
├── config/               # Environment config + validation
├── common/
│   ├── filters/          # Global exception handler
│   └── interceptors/     # Request logging
├── integrations/
│   └── mollie/           # Mollie API client, types, mapper, errors
├── merchants/            # Token store (swap for DB-backed implementation)
└── onboarding/           # Feature: controllers, service, DTOs
```

**Token storage:** Tokens are stored in-memory by default. In production, replace `MerchantTokenStore` with a database-backed implementation. Refresh tokens must be encrypted at rest.
