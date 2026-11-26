export function needsReopeningReason(current: string, next: string) {
  return current === 'Atlikta' && next !== 'Atlikta';
}

export function validateStatusChange(current: string, next: string, reason = '') {
  if (needsReopeningReason(current, next) && !reason.trim()) {
    throw new Error('Nurodykite būsenos keitimo priežastį.');
  }
}

export function validateReportResend(sentAt: string | null, expectedSentAt: string | null, confirmed: boolean) {
  if (sentAt !== expectedSentAt) throw new Error('Siuntimo informacija pasikeitė. Atnaujinkite užsakymą prieš siųsdami.');
  if (sentAt && !confirmed) throw new Error('Patvirtinkite pakartotinį ataskaitos siuntimą.');
}

export function reportSendKey(orderId: string, sentAt: string | null) {
  return `report-${orderId}-${sentAt ?? 'first'}`;
}