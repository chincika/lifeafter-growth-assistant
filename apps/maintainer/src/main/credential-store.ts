import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type SecretCipher = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

const FILE_NAME = "github-credentials.json";
const credentialPath = (directory: string) => join(directory, FILE_NAME);

export function loadGithubToken(directory: string, cipher: SecretCipher): string {
  const path = credentialPath(directory);
  if (!existsSync(path) || !cipher.isEncryptionAvailable()) return "";
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { version?: number; encryptedToken?: string };
    if (value.version !== 1 || !value.encryptedToken) return "";
    return cipher.decryptString(Buffer.from(value.encryptedToken, "base64"));
  } catch {
    return "";
  }
}

export function saveGithubToken(directory: string, token: string, cipher: SecretCipher): void {
  if (token.length < 20) throw new Error("GitHub Token 格式无效");
  if (!cipher.isEncryptionAvailable()) throw new Error("Windows 系统加密当前不可用");
  mkdirSync(directory, { recursive: true });
  const path = credentialPath(directory);
  const temporary = `${path}.tmp`;
  const payload = { version: 1, encryptedToken: cipher.encryptString(token).toString("base64") };
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
}

export function clearGithubToken(directory: string): void {
  rmSync(credentialPath(directory), { force: true });
}
