const CONTENT_VERSION_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/;

function parts(version: string): number[] {
  const match = CONTENT_VERSION_PATTERN.exec(version);
  if (!match) throw new Error("资料版本必须形如 2026.07.17.1");
  return match.slice(1).map(Number);
}

export function compareContentVersions(left: string, right: string): number {
  const leftParts = parts(left);
  const rightParts = parts(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function suggestContentVersion(current: string, now = new Date()): string {
  parts(current);
  const prefix = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"))
    .join(".");
  const match = CONTENT_VERSION_PATTERN.exec(current)!;
  return current.startsWith(`${prefix}.`) ? `${prefix}.${Number(match[4]) + 1}` : `${prefix}.1`;
}

export function resolveReleaseContentVersion(requested: string, remote: string | undefined, now = new Date()): string {
  parts(requested);
  if (!remote || compareContentVersions(requested, remote) > 0) return requested;
  return suggestContentVersion(remote, now);
}
