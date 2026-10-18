import { describe, expect, it } from "vitest";
import { buildAssetLinks, parseFingerprints } from "./assetLinks";

const A = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const B_RAW = "aa bb cc dd ee ff 00 11 22 33 44 55 66 77 88 99 aa bb cc dd ee ff 00 11 22 33 44 55 66 77 88 99".replace(/ /g, "");

describe("parseFingerprints", () => {
  it("normalises case and colons, splits on commas/newlines, de-duplicates", () => {
    const result = parseFingerprints(`${A.toLowerCase()},\n${B_RAW}  ${A}`);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(A);
    expect(result[1]).toMatch(/^AA:BB:CC/);
  });

  it("drops values that are not SHA-256 fingerprints", () => {
    expect(parseFingerprints("abc, 12:34")).toEqual([]);
    expect(parseFingerprints(undefined)).toEqual([]);
  });
});

describe("buildAssetLinks", () => {
  it("returns an empty list until a fingerprint is configured", () => {
    expect(buildAssetLinks({})).toEqual([]);
  });

  it("uses the default package name", () => {
    const [statement] = buildAssetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: A });
    expect(statement.target.package_name).toBe("com.shilpikala.app");
    expect(statement.target.sha256_cert_fingerprints).toEqual([A]);
    expect(statement.relation).toContain("delegate_permission/common.handle_all_urls");
  });

  it("honours a custom package name", () => {
    const [statement] = buildAssetLinks({
      ANDROID_PACKAGE_NAME: "com.example.store",
      ANDROID_SHA256_CERT_FINGERPRINTS: A,
    });
    expect(statement.target.package_name).toBe("com.example.store");
  });
});
