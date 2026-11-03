import { describe, it, expect } from "vitest";
import { siteUrl } from "@/lib/site-url";
describe("siteUrl", () => {
  it("defaults to padeliok.lt", () => expect(siteUrl()).toBe("https://padeliok.lt"));
  it("rejects Lovable domains", () => expect(siteUrl("https://padeliok.lovable.app")).toBe("https://padeliok.lt"));
  it("accepts custom https override", () => expect(siteUrl("https://www.padeliok.lt/")).toBe("https://www.padeliok.lt"));
});
