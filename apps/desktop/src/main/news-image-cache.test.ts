import { describe, expect, it } from "vitest";
import { cachedNewsImageMatches, detectNewsImageContentType, newsImageProtocolUrl, newsImageRemoteCandidates, remoteNewsImageFetchUrl } from "./news-image-cache";

describe("news image cache", () => {
  it("versions the renderer URL with the published image hash", () => {
    expect(newsImageProtocolUrl("news.maintained.example", "ABC123", "launch-1")).toBe(
      "lifeafter-news://image/news.maintained.example?v=abc123&session=launch-1",
    );
  });

  it("uses a different remote URL for every application launch", () => {
    expect(remoteNewsImageFetchUrl("https://cdn.example.com/news.png", "ABC123", "launch-2")).toBe(
      "https://cdn.example.com/news.png?v=abc123-launch-2",
    );
  });

  it("falls back from jsDelivr to the same GitHub Raw asset", () => {
    expect(newsImageRemoteCandidates("https://cdn.jsdelivr.net/gh/example/repo@main/releases/news/example.png")).toEqual([
      "https://cdn.jsdelivr.net/gh/example/repo@main/releases/news/example.png",
      "https://raw.githubusercontent.com/example/repo/main/releases/news/example.png",
    ]);
  });

  it("rejects stale bytes for an updated image", () => {
    expect(cachedNewsImageMatches(Buffer.from("old"), "cba06b5736faf67e54b07b561eae94395e774c517a7d910a54369e1263ccfbd4")).toBe(true);
    expect(cachedNewsImageMatches(Buffer.from("old"), "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")).toBe(false);
  });

  it("recognizes image bytes even when a server reports application/octet-stream", () => {
    expect(detectNewsImageContentType(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]))).toBe("image/png");
    expect(detectNewsImageContentType(Buffer.from([0xff,0xd8,0xff,0x00]))).toBe("image/jpeg");
    expect(detectNewsImageContentType(Buffer.from("not-an-image"))).toBeUndefined();
  });
});
