import { describe, it, expect } from "vitest";
import { parseExternalUrl, parseInternalRoute } from "@/lib/ads/destination";

describe("destinations", () => {
  it("accepts normal internal routes", () => {
    expect(parseInternalRoute("/shop")).toBe("/shop");
    expect(parseInternalRoute(" /categories/lipan-art?x=1 ")).toBe("/categories/lipan-art?x=1");
  });
  it("rejects unsafe internal routes", () => {
    for (const bad of ["shop", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/admin", "/admin/ads", "/api/admin/ads", "/a b", "/x\ny", "", "https://x.com", 5, undefined])
      expect(parseInternalRoute(bad as string)).toBeUndefined();
  });
  it("accepts http(s) only", () => {
    expect(parseExternalUrl("https://example.com/sale")).toBe("https://example.com/sale");
    expect(parseExternalUrl("http://example.com")).toBe("http://example.com/");
  });
  it("rejects dangerous or malformed external URLs", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "ftp://x.com", "https://user:pw@x.com", "https://", "//x.com", "example.com", "https://x.com/a b", "vbscript:x"])
      expect(parseExternalUrl(bad)).toBeUndefined();
  });
});
