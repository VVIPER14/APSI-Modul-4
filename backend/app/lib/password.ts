import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derivePasswordHash(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derivePasswordHash(password, salt);

  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  providedPassword: string,
  storedPassword: string,
) {
  const [algorithm, salt, hash] = storedPassword.split("$");

  if (algorithm === "scrypt") {
    if (!salt || !hash || !/^[\da-f]{128}$/i.test(hash)) {
      return { valid: false, needsRehash: false };
    }

    const derivedKey = await derivePasswordHash(providedPassword, salt);
    const expectedHash = Buffer.from(hash, "hex");

    return {
      valid:
        derivedKey.length === expectedHash.length &&
        timingSafeEqual(derivedKey, expectedHash),
      needsRehash: false,
    };
  }

  const provided = Buffer.from(providedPassword);
  const stored = Buffer.from(storedPassword);

  return {
    valid:
      provided.length === stored.length && timingSafeEqual(provided, stored),
    needsRehash: true,
  };
}
