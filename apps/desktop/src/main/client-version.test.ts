import { describe, expect, it } from "vitest";
import { isClientVersionNewer } from "./client-version";

describe("client version comparison",()=>{
  it("does not offer a downgrade",()=>expect(isClientVersionNewer("0.1.1","0.1.2")).toBe(false));
  it("recognizes a newer release",()=>expect(isClientVersionNewer("0.2.0","0.1.9")).toBe(true));
  it("treats equivalent versions as current",()=>expect(isClientVersionNewer("0.1.2.0","0.1.2")).toBe(false));
});
