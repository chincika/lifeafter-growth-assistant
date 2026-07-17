import { describe, expect, it, vi } from "vitest";
import { resolveNewsRecordId } from "./news-record-id";

describe("news record identity", () => {
  it("rotates the ID when a maintained image is replaced", () => {
    expect(resolveNewsRecordId({
      previousId: "news.maintained.old",
      previousImageFile: "news-images/old.png",
      nextImageFile: "news-images/new.png",
      generateId: () => "news.maintained.new",
    })).toBe("news.maintained.new");
  });

  it("keeps the ID when only title or date fields change", () => {
    const generateId = vi.fn(() => "news.maintained.new");
    expect(resolveNewsRecordId({
      previousId: "news.maintained.current",
      previousImageFile: "news-images/current.png",
      nextImageFile: "news-images/current.png",
      generateId,
    })).toBe("news.maintained.current");
    expect(generateId).not.toHaveBeenCalled();
  });
});
