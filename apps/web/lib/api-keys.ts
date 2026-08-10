import crypto from "crypto";

const KEY_PREFIX = "pak_";
/** Characters of the raw key kept in `key_prefix` so the UI can identify an existing key. */
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 8;

export function generateApiKey() {
  const key = `${KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

/**
 * API keys are high-entropy random tokens, so a plain SHA-256 is sufficient here;
 * they are not guessable and do not need a slow password hash.
 */
export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}
