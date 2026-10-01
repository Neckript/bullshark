import { z } from 'zod';

// Applies only where a password is being CHOSEN: self-registration and the
// password change form. It is deliberately not applied when an existing
// password is being checked - /login and the `currentPassword` field have to
// keep accepting shorter ones, or every account created under the old
// 4-character rule is locked out of its own server.
const NEW_PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const zNewPassword = z
  .string()
  .min(
    NEW_PASSWORD_MIN_LENGTH,
    `Password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters long`
  )
  .max(PASSWORD_MAX_LENGTH);

export { NEW_PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, zNewPassword };
