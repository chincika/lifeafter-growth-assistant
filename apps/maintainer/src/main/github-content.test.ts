import { describe, expect, it, vi } from "vitest";
import { writeGithubContent, type GithubFetch } from "./github-content.js";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const input = (fetcher: GithubFetch) => ({
  repository: "owner/repository",
  branch: "main",
  token: "github_pat_test-token-value",
  path: "releases/base-data.json",
  content: Buffer.from("updated"),
  fetcher,
  delay: async () => undefined,
});

describe("writeGithubContent", () => {
  it("re-reads the latest SHA and succeeds after a 409 conflict", async () => {
    const fetcher = vi
      .fn<GithubFetch>()
      .mockResolvedValueOnce(json({ sha: "stale-sha" }))
      .mockResolvedValueOnce(json({ message: "does not match" }, 409))
      .mockResolvedValueOnce(json({ sha: "latest-sha" }))
      .mockResolvedValueOnce(json({ content: { sha: "written-sha" } }));

    await expect(writeGithubContent(input(fetcher))).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledTimes(4);
    const firstGet = fetcher.mock.calls[0]!;
    const secondGet = fetcher.mock.calls[2]!;
    expect(firstGet[0]).toContain("publishAttempt=");
    expect(firstGet[1]?.cache).toBe("no-store");
    expect(secondGet[0]).toContain("publishAttempt=");
    const firstPut = JSON.parse(String(fetcher.mock.calls[1]![1]?.body));
    const secondPut = JSON.parse(String(fetcher.mock.calls[3]![1]?.body));
    expect(firstPut.sha).toBe("stale-sha");
    expect(secondPut.sha).toBe("latest-sha");
  });

  it("recovers when another publisher creates a previously missing file", async () => {
    const fetcher = vi
      .fn<GithubFetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json({ message: "conflict" }, 409))
      .mockResolvedValueOnce(json({ sha: "concurrent-sha" }))
      .mockResolvedValueOnce(json({ content: { sha: "written-sha" } }));

    await writeGithubContent(input(fetcher));

    const firstPut = JSON.parse(String(fetcher.mock.calls[1]![1]?.body));
    const secondPut = JSON.parse(String(fetcher.mock.calls[3]![1]?.body));
    expect(firstPut).not.toHaveProperty("sha");
    expect(secondPut.sha).toBe("concurrent-sha");
  });

  it("does not retry authorization and validation failures", async () => {
    const fetcher = vi
      .fn<GithubFetch>()
      .mockResolvedValueOnce(json({ sha: "current-sha" }))
      .mockResolvedValueOnce(json({ message: "forbidden" }, 403));

    await expect(writeGithubContent(input(fetcher))).rejects.toThrow(
      "HTTP 403",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("stops with a clear error after repeated conflicts", async () => {
    const fetcher = vi.fn<GithubFetch>();
    for (let index = 0; index < 3; index += 1) {
      fetcher.mockResolvedValueOnce(json({ sha: `sha-${index}` }));
      fetcher.mockResolvedValueOnce(json({ message: "does not match" }, 409));
    }

    await expect(
      writeGithubContent({ ...input(fetcher), maxAttempts: 3 }),
    ).rejects.toThrow("已自动刷新并重试 3 次");
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
});
