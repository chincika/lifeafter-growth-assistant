import { createHash } from "node:crypto";

export interface NewsImageSource {
  url: string;
  sha256?: string;
}

export function newsImageProtocolUrl(id: string, sha256?: string, sessionNonce?: string): string {
  const parameters = new URLSearchParams();
  if (sha256) parameters.set("v", sha256.toLowerCase());
  if (sessionNonce) parameters.set("session", sessionNonce);
  const query = parameters.size ? `?${parameters.toString()}` : "";
  return `lifeafter-news://image/${encodeURIComponent(id)}${query}`;
}

export function remoteNewsImageFetchUrl(value: string, sha256: string | undefined, sessionNonce: string): string {
  const url = new URL(value);
  url.searchParams.set("v", `${sha256?.toLowerCase() ?? "unversioned"}-${sessionNonce}`);
  return url.toString();
}

export function newsImageRemoteCandidates(value: string): string[] {
  const primary = new URL(value);
  const candidates = [primary.toString()];
  if (primary.hostname === "cdn.jsdelivr.net") {
    const match = primary.pathname.match(/^\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/);
    if (match) candidates.push(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`);
  }
  return candidates;
}

export function cachedNewsImageMatches(buffer: Buffer, expectedSha256?: string): boolean {
  if (!expectedSha256) return true;
  return createHash("sha256").update(buffer).digest("hex") === expectedSha256.toLowerCase();
}

export function detectNewsImageContentType(buffer: Buffer): string | undefined {
  if (buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff) return "image/jpeg";
  if (buffer.subarray(0,4).toString("ascii")==="RIFF"&&buffer.subarray(8,12).toString("ascii")==="WEBP") return "image/webp";
  return undefined;
}
