import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;

export const strongPasswordSchema = z.string()
 .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
 .max(72, 'Password must be 72 characters or fewer.')
 .regex(/[a-z]/, 'Add a lowercase letter.')
 .regex(/[A-Z]/, 'Add an uppercase letter.')
 .regex(/[0-9]/, 'Add a number.');

export function passwordRequirements(password: string) {
 return {
  length: password.length >= PASSWORD_MIN_LENGTH,
  lowercase: /[a-z]/.test(password),
  uppercase: /[A-Z]/.test(password),
  number: /[0-9]/.test(password)
 };
}
