import {
  randomBytes,
  scrypt,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const MAGIC = Buffer.from("RECHLYBK\x01", "binary");
const HEADER = MAGIC.length + 16 + 12 + 16;
export function isEncryptedBackup(data: Buffer): boolean {
  return data.subarray(0, MAGIC.length).equals(MAGIC);
}
export function checkPassword(password: unknown): asserts password is string {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 1024
  )
    throw new Error(
      "Das Sicherungspasswort muss 12 bis 1.024 Zeichen enthalten.",
    );
}
async function keyFor(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      32,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function encryptBackup(
  plain: Buffer,
  password: string,
): Promise<Buffer> {
  checkPassword(password);
  if (plain.length > MAX_BACKUP_BYTES - HEADER)
    throw new Error("Die Sicherung überschreitet 64 MB.");
  const salt = randomBytes(16),
    iv = randomBytes(12),
    key = await keyFor(password, salt);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(MAGIC);
    const body = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
  } finally {
    key.fill(0);
  }
}
export async function decryptBackup(
  data: Buffer,
  password: string,
): Promise<Buffer> {
  checkPassword(password);
  if (
    data.length < HEADER ||
    data.length > MAX_BACKUP_BYTES ||
    !isEncryptedBackup(data)
  )
    throw new Error("Unbekanntes oder beschädigtes Sicherungsformat.");
  let offset = MAGIC.length;
  const salt = data.subarray(offset, (offset += 16)),
    iv = data.subarray(offset, (offset += 12)),
    tag = data.subarray(offset, (offset += 16)),
    key = await keyFor(password, salt);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(data.subarray(offset)),
      decipher.final(),
    ]);
  } catch {
    throw new Error(
      "Falsches Passwort oder beschädigte Sicherung. Es wurden keine Daten verändert.",
    );
  } finally {
    key.fill(0);
  }
}
export function readBackupFile(file: string): Buffer {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_BACKUP_BYTES)
    throw new Error("Die Sicherungsdatei ist ungültig oder größer als 64 MB.");
  return fs.readFileSync(file);
}
export function atomicWrite(file: string, data: Buffer): void {
  const temp = path.join(
    path.dirname(file),
    ".rechly-" + randomBytes(12).toString("hex") + ".tmp",
  );
  try {
    const fd = fs.openSync(temp, "wx", 0o600);
    try {
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, file);
    syncDirectory(path.dirname(file));
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

/** Persist directory entries after promoting a new file on Unix filesystems. */
export function syncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  const fd = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(fd);
  } catch (error) {
    if (
      !["EINVAL", "ENOTSUP"].includes(
        (error as NodeJS.ErrnoException).code || "",
      )
    )
      throw error;
  } finally {
    fs.closeSync(fd);
  }
}
