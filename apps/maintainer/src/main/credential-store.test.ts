import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearGithubToken, loadGithubToken, saveGithubToken, type SecretCipher } from "./credential-store.js";

const directories: string[] = [];
const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from([...value].reverse().join("")),
  decryptString: (value) => [...value.toString()].reverse().join(""),
};
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("maintainer credential store", () => {
  it("persists an encrypted token and can clear it", () => {
    const directory = mkdtempSync(join(tmpdir(), "lifeafter-credential-")); directories.push(directory);
    const token = "github_pat_example_secret_value";
    saveGithubToken(directory, token, cipher);
    expect(loadGithubToken(directory, cipher)).toBe(token);
    expect(readFileSync(join(directory, "github-credentials.json"), "utf8")).not.toContain(token);
    clearGithubToken(directory);
    expect(loadGithubToken(directory, cipher)).toBe("");
  });

  it("does not persist plaintext when system encryption is unavailable", () => {
    const directory = mkdtempSync(join(tmpdir(), "lifeafter-credential-")); directories.push(directory);
    expect(() => saveGithubToken(directory, "github_pat_example_secret_value", { ...cipher, isEncryptionAvailable: () => false })).toThrow("Windows 系统加密当前不可用");
  });
});
