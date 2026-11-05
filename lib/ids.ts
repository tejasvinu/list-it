import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const LIMIT = 256 - (256 % ALPHABET.length);

/** URL-safe random id without look-alike characters. Rejection sampling keeps the alphabet unbiased. */
export function rid(length = 12) {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < LIMIT) {
        out += ALPHABET[byte % ALPHABET.length];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "crew"
  );
}

/** Share-link slug: readable prefix plus an unguessable tail. */
export function groupSlug(name: string) {
  return `${slugify(name)}-${rid(10)}`;
}
