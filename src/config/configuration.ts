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

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mollie: {
      clientId: process.env.MOLLIE_CLIENT_ID!,
      clientSecret: process.env.MOLLIE_CLIENT_SECRET!,
      accessToken: process.env.MOLLIE_ACCESS_TOKEN!,
      redirectUri: process.env.MOLLIE_REDIRECT_URI!,
      apiBaseUrl: 'https://api.mollie.com',
      oauthBaseUrl: 'https://my.mollie.com',
    },
    appBaseUrl: process.env.APP_BASE_URL!,
  };
};
