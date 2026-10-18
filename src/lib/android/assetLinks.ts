export const DEFAULT_ANDROID_PACKAGE = "com.shilpikala.app";

type AssetLinksEnv = {
  ANDROID_PACKAGE_NAME?: string;
  ANDROID_SHA256_CERT_FINGERPRINTS?: string;
};

export type AssetLinkStatement = {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * Accepts fingerprints separated by commas, spaces or newlines, with or
 * without colons, in any case (as copied from Play Console or keytool),
 * and returns them in the colon-separated upper-case form Android expects.
 * Anything that isn't a SHA-256 fingerprint is dropped.
 */
export function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const hex = part.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    if (hex.length !== 64) continue;
    const formatted = hex.match(/.{2}/g)!.join(":");
    if (FINGERPRINT.test(formatted)) seen.add(formatted);
  }
  return [...seen];
}

export function buildAssetLinks(env: AssetLinksEnv): AssetLinkStatement[] {
  const fingerprints = parseFingerprints(env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
