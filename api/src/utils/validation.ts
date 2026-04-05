import type { UserRole } from '../types';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateMBID(id: string): boolean {
  return typeof id === 'string' && UUID_V4_RE.test(id);
}

const ROLES: readonly UserRole[] = ['guest', 'user', 'moderator', 'admin'];

export function validateRole(role: string): role is UserRole {
  return (ROLES as readonly string[]).includes(role);
}

const MAX_TEXT_LENGTH = 500;

export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_TEXT_LENGTH);
}
