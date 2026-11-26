/** Preserve sandbox by default; production is an explicit server configuration. */
export function montonioEnvironment(): 'sandbox' | 'production' {
  const environment = process.env['MONTONIO_ENVIRONMENT'] ?? 'sandbox';
  if (environment === 'production' || environment === 'sandbox') return environment;
  throw new Error('Unsupported Montonio environment');
}

export function montonioApi() {
  return montonioEnvironment() === 'production'
    ? 'https://stargate.montonio.com/api'
    : 'https://sandbox-stargate.montonio.com/api';
}
