import { describe, expect, it } from "vitest";
import { withAutomaticNews } from "./release-policy";

describe("maintainer release policy", () => {
  it("automatically includes news in a full release when the news channel is enabled", () => {
    expect(withAutomaticNews({ repository: "owner/repo" }, true)).toEqual({
      repository: "owner/repo",
      includeNews: true,
    });
  });

  it("does not mutate the form model", () => {
    const release = { repository: "owner/repo" };
    withAutomaticNews(release, true);
    expect(release).toEqual({ repository: "owner/repo" });
  });
});
