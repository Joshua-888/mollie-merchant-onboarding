/** OAuth scopes requested when redirecting merchants to Mollie (see Authorize API). */
export const MOLLIE_OAUTH_SCOPES = [
  'organizations.read',
  'onboarding.read',
  'onboarding.write',
  'profiles.read',
  'profiles.write',
  'payments.read',
  'payments.write',
] as const;

export type MollieApiMode = 'test' | 'live';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  mollie: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    redirectUri: string;
    apiBaseUrl: string;
    oauthBaseUrl: string;
    apiMode: MollieApiMode;
  };
  appBaseUrl: string;
}

export default (): AppConfig => {
  const required = [
    'MOLLIE_CLIENT_ID',
    'MOLLIE_CLIENT_SECRET',
    'MOLLIE_ACCESS_TOKEN',
    'MOLLIE_REDIRECT_URI',
    'APP_BASE_URL',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const apiMode =
    process.env.MOLLIE_API_MODE === 'live' || process.env.MOLLIE_API_MODE === 'test'
      ? process.env.MOLLIE_API_MODE
      : nodeEnv === 'production'
        ? 'live'
        : 'test';

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv,
    mollie: {
      clientId: process.env.MOLLIE_CLIENT_ID!,
      clientSecret: process.env.MOLLIE_CLIENT_SECRET!,
      accessToken: process.env.MOLLIE_ACCESS_TOKEN!,
      redirectUri: process.env.MOLLIE_REDIRECT_URI!,
      apiBaseUrl: 'https://api.mollie.com',
      oauthBaseUrl: 'https://my.mollie.com',
      apiMode,
    },
    appBaseUrl: process.env.APP_BASE_URL!,
  };
};
