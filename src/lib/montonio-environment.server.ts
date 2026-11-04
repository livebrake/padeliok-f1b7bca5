/** Preserve sandbox by default; production is an explicit server configuration. */
export function montonioApi() {
  const environment = process.env['MONTONIO_ENVIRONMENT'] ?? 'sandbox';
  if (environment === 'production') return 'https://stargate.montonio.com/api';
  if (environment === 'sandbox') return 'https://sandbox-stargate.montonio.com/api';
  throw new Error('Unsupported Montonio environment');
}