import { describe, expect, it } from 'vitest';
import { canResetTeamPassword, invitationSchema, passwordSchema } from '@/lib/team-auth';

describe('Team email and password rules', () => {
  const invitation = { name: 'Jonas', email: 'jonas@example.com', role: 'employee', origin: 'https://padeliok.lt' };
  it('requires an invite name', () => { expect(invitationSchema.safeParse({ ...invitation, name: ' ' }).success).toBe(false); });
  it('rejects malformed invite emails', () => { expect(invitationSchema.safeParse({ ...invitation, email: 'jonas@' }).success).toBe(false); expect(invitationSchema.safeParse(invitation).success).toBe(true); });
  it('allows password recovery only for a supervisor and active member', () => { expect(canResetTeamPassword('super_admin', true)).toBe(true); expect(canResetTeamPassword('employee', true)).toBe(false); expect(canResetTeamPassword('super_admin', false)).toBe(false); expect(canResetTeamPassword(null, true)).toBe(false); });
  it('requires at least 8 characters', () => { expect(passwordSchema.safeParse('1234567').success).toBe(false); expect(passwordSchema.safeParse('12345678').success).toBe(true); });
});