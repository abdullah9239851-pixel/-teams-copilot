import crypto from 'crypto';

/**
 * Optional encryption-at-rest for sensitive JSON (Microsoft OAuth tokens).
 *
 * If APP_ENCRYPTION_KEY is set (32-byte value, hex or base64 or raw), payloads
 * are sealed with AES-256-GCM. If it is not set yet, values are stored as-is so
 * the app keeps working before keys are provisioned — decrypt transparently
 * handles both shapes. Provisioning the key later encrypts everything written
 * from then on.
 */

const MAGIC = 'enc.v1:';

function getKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) return null;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
  else if (/^[A-Za-z0-9+/=]{44}$/.test(raw)) key = Buffer.from(raw, 'base64');
  else key = crypto.createHash('sha256').update(raw).digest();
  return key.length === 32 ? key : crypto.createHash('sha256').update(raw).digest();
}

export function encryptJson(value: unknown): unknown {
  const key = getKey();
  const plaintext = JSON.stringify(value);
  if (!key) return value; // no key yet — store plaintext

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]).toString('base64');
  return { __sealed: `${MAGIC}${packed}` };
}

export function decryptJson<T = unknown>(stored: unknown): T | null {
  if (stored == null) return null;
  const sealed = (stored as any)?.__sealed;
  if (typeof sealed !== 'string' || !sealed.startsWith(MAGIC)) {
    // Plaintext (either never encrypted, or key not configured)
    return stored as T;
  }
  const key = getKey();
  if (!key) throw new Error('Encrypted value found but APP_ENCRYPTION_KEY is not set');

  const packed = Buffer.from(sealed.slice(MAGIC.length), 'base64');
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const enc = packed.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(dec) as T;
}
