export type GithubFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface GithubContentWriteInput {
  repository: string;
  branch: string;
  token: string;
  path: string;
  content: Buffer;
  fetcher: GithubFetch;
  maxAttempts?: number;
  delay?: (milliseconds: number) => Promise<void>;
}

const githubHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "lifeafter-content-maintainer",
});

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function readLatestSha(
  endpoint: string,
  branch: string,
  token: string,
  path: string,
  attempt: number,
  fetcher: GithubFetch,
) {
  const url = new URL(endpoint);
  url.searchParams.set("ref", branch);
  // The Contents API response may otherwise be served from an intermediate cache
  // immediately after the preceding file created a new commit on the same branch.
  url.searchParams.set("publishAttempt", `${Date.now()}-${attempt}`);
  const response = await fetcher(url.toString(), {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`读取 GitHub ${path} 失败：HTTP ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { sha?: unknown };
  const sha = typeof body.sha === "string" ? body.sha : "";
  if (!sha) throw new Error(`读取 GitHub ${path} 失败：响应缺少文件 SHA`);
  return sha;
}

function isRetryableConflict(status: number, body: string) {
  return status === 409 || (status === 422 && /sha|does not match/i.test(body));
}

/**
 * Updates one file through GitHub's Contents API.
 *
 * Every attempt re-reads the current file SHA. This is important because a
 * release writes several files and every successful write advances the branch.
 */
export async function writeGithubContent(input: GithubContentWriteInput) {
  const endpoint = `https://api.github.com/repos/${input.repository}/contents/${input.path}`;
  const maxAttempts = Math.max(1, input.maxAttempts ?? 4);
  const delay = input.delay ?? wait;
  let lastConflict = "";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const existingSha = await readLatestSha(
      endpoint,
      input.branch,
      input.token,
      input.path,
      attempt,
      input.fetcher,
    );
    const response = await input.fetcher(endpoint, {
      method: "PUT",
      headers: {
        ...githubHeaders(input.token),
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        message: `chore(content): publish ${input.path}`,
        content: input.content.toString("base64"),
        branch: input.branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });
    if (response.ok) return;

    const body = await response.text();
    if (!isRetryableConflict(response.status, body)) {
      throw new Error(`发布 ${input.path} 失败：HTTP ${response.status} ${body}`);
    }

    lastConflict = body;
    if (attempt + 1 < maxAttempts) await delay(150 * 2 ** attempt);
  }

  throw new Error(
    `发布 ${input.path} 失败：GitHub 文件在发布期间连续发生冲突，已自动刷新并重试 ${maxAttempts} 次。${lastConflict ? ` ${lastConflict}` : ""}`,
  );
}
