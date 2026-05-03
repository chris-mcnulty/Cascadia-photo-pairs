import Stripe from 'stripe';

interface StripeConnectionSettings {
  publishable: string;
  secret: string;
}

interface ReplitConnection {
  settings: StripeConnectionSettings;
}

interface ReplitConnectionResponse {
  items?: ReplitConnection[];
}

let cached: StripeConnectionSettings | null = null;

async function getCredentials(): Promise<StripeConnectionSettings> {
  if (cached) return cached;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error('Replit connector credentials not present in environment.');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Replit-Token': xReplitToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Stripe connector lookup failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ReplitConnectionResponse;
  const settings = data.items?.[0]?.settings;

  if (!settings || !settings.publishable || !settings.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not configured.`);
  }

  cached = settings;
  return settings;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials().then((s) => ({ secretKey: s.secret }));
  // Stripe API version is typed as a string-literal union; the connector
  // negotiates the version, so we cast to the SDK's expected type.
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const settings = await getCredentials();
  return settings.publishable;
}

export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}
