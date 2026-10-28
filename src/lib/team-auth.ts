import { z } from 'zod';

const required = 'Prašome užpildyti visus privalomus laukus.';
export const invitationSchema = z.object({
  name: z.string({ required_error: required }).trim().min(1, required).max(120, 'Vardas negali būti ilgesnis nei 120 simbolių.'),
  email: z.string({ required_error: required }).trim().min(1, required).email('Neteisingas el. pašto adreso formatas.'),
  role: z.enum(['super_admin', 'employee'], { errorMap: () => ({ message: 'Pasirinkite darbuotojo teises.' }) }),
  origin: z.string().url('Neteisingas kvietimo adresas.'),
});
export const recoverySchema = z.object({ userId: z.string().uuid('Neteisingas darbuotojo identifikatorius.'), origin: z.string().url('Neteisingas atkūrimo adresas.') });
export const passwordSchema = z.string().min(12, 'Slaptažodį turi sudaryti bent 12 simbolių.');
export function canResetTeamPassword(role: string | null | undefined, active: boolean) { return role === 'super_admin' && active; }

/** Never expose raw provider, database or serialized validation errors to members. */
export function teamAuthMessage(error: unknown, fallback = 'Veiksmo atlikti nepavyko. Bandykite dar kartą.'): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? required;
  const value = error && typeof error === 'object' ? error as { code?: string; message?: string } : {};
  const code = value.code ?? '';
  const message = value.message ?? '';
  if (['email_exists', 'user_already_exists'].includes(code) || /already.*(registered|exists)/i.test(message)) return 'Vartotojas su šiuo el. paštu jau užregistruotas.';
  if (code === 'email_address_invalid' || /invalid email|invalid.*email.*address/i.test(message)) return 'Neteisingas el. pašto adreso formatas.';
  if (/email address is not allowed|email_address_not_authorized/i.test(code + message)) return 'Šiuo el. pašto adresu laiškų siųsti negalima. Patikrinkite adresą ir jo domeną.';
  if (/rate_limit|too many requests|rate limit/i.test(code + message)) return 'Per daug bandymų. Palaukite ir bandykite dar kartą.';
  if (/same_password|same.*password/i.test(code + message)) return 'Naujas slaptažodis turi skirtis nuo dabartinio.';
  if (/weak_password|password.*(weak|short)/i.test(code + message)) return 'Slaptažodis per silpnas. Naudokite bent 12 simbolių, raides ir skaičius.';
  if (/otp_expired|session_not_found|bad_code_verifier|flow_state_expired/i.test(code)) return 'Nuoroda nebegalioja. Paprašykite vadovo atsiųsti naują nuorodą.';
  if (/fetch|network/i.test(message)) return 'Nepavyko susisiekti su serveriu. Bandykite dar kartą.';
  // Project-owned Lithuanian errors are safe; unknown provider text uses a localized fallback.
  if (/[ąčęėįšųūž]/i.test(message) && !message.startsWith('[')) return message;
  return fallback;
}