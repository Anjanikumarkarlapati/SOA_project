export type SocialPlatform =
  | "whatsapp"
  | "instagram"
  | "reddit"
  | "x"
  | "youtube"
  | "gov"
  | "web";

export type UrlSafetyResult =
  | {
      ok: true;
      url: URL;
      platform: SocialPlatform;
      warnings: string[];
      scamRisk: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

const URL_SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "rb.gy",
  "cutt.ly",
  "is.gd",
  "ow.ly",
  "shorturl.at",
]);

const LOOKALIKE_PHISHING_PATTERNS = [
  /pm-?kisan-/i,
  /pmkisan[^.]*\.(com|in|org|net|xyz|top|online|site|click|info)$/i,
  /kisan-?registration/i,
  /pmfby-/i,
  /kisan-?(yojana|bonus|subsidy|fund|grant)/i,
  /sarkari-?(kisan|yojana)/i,
  /free-?(tractor|fertilizer|urea|solar-?pump)/i,
];

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isPrivateOrReservedIpv4Octets(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function parseDottedIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  if (!parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => n < 0 || n > 255)) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

function isBlockedIpv6(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(":")) return false;

  if (
    host === "::" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:0" ||
    host === "0:0:0:0:0:0:0:1"
  ) {
    return true;
  }

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1 (Node WHATWG URL normalizes to hex!)
  const mappedDotted = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedDotted) {
    const octets = parseDottedIpv4(mappedDotted[1]);
    return !octets || isPrivateOrReservedIpv4Octets(...octets);
  }
  const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateOrReservedIpv4Octets((hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff);
  }

  // fc00::/7 (Unique Local Addresses: fc00..fdff) and fe80::/10 (Link-local: fe80..febf)
  const firstSegment = host.split(":")[0];
  if (firstSegment) {
    const val = parseInt(firstSegment, 16);
    if (!Number.isNaN(val)) {
      if ((val & 0xfe00) === 0xfc00) return true; // fc00::/7
      if ((val & 0xffc0) === 0xfe80) return true; // fe80::/10
    }
  }

  return false;
}

function isBlockedHost(rawHostname: string): boolean {
  const host = rawHostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (!host) return true;

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  // Single integer or hex IP representation if left unnormalized
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return true;
  }

  const ipv4 = parseDottedIpv4(host);
  if (ipv4) {
    return isPrivateOrReservedIpv4Octets(...ipv4);
  }

  if (host.includes(":")) {
    return isBlockedIpv6(host);
  }

  return false;
}

function classifyPlatform(hostname: string): SocialPlatform {
  if (hostMatches(hostname, "whatsapp.com") || hostMatches(hostname, "wa.me")) {
    return "whatsapp";
  }
  if (hostMatches(hostname, "instagram.com") || hostMatches(hostname, "instagr.am")) {
    return "instagram";
  }
  if (hostMatches(hostname, "reddit.com") || hostMatches(hostname, "redd.it")) {
    return "reddit";
  }
  if (hostMatches(hostname, "x.com") || hostMatches(hostname, "twitter.com")) {
    return "x";
  }
  if (hostMatches(hostname, "youtube.com") || hostMatches(hostname, "youtu.be")) {
    return "youtube";
  }
  if (hostMatches(hostname, "gov.in") || hostMatches(hostname, "nic.in")) {
    return "gov";
  }
  return "web";
}

/**
 * Validates that a user-submitted social or news URL is a safe public HTTP(S) target,
 * preventing SSRF while classifying platform and flagging APK/shortener/phishing risks.
 */
export function validatePublicSocialUrl(rawUrl: string): UrlSafetyResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, reason: "Please enter a valid http:// or https:// URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Invalid URL format. Include https:// before the domain." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Unsupported URL scheme "${parsed.protocol}". Only http and https are allowed.` };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with embedded credentials are not permitted." };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (isBlockedHost(hostname)) {
    return { ok: false, reason: "Private, loopback, or internal network addresses cannot be verified." };
  }

  const platform = classifyPlatform(hostname);
  const warnings: string[] = [];
  let scamRisk = false;

  const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
  if (/\.apk($|[?&#/])/.test(pathAndQuery)) {
    scamRisk = true;
    warnings.push("Direct .apk file download detected — high malware/banking-fraud risk.");
  }

  if (URL_SHORTENERS.has(hostname)) {
    scamRisk = true;
    warnings.push(`Shortened link (${hostname}) hides the true destination domain.`);
  }

  if (platform !== "gov" && LOOKALIKE_PHISHING_PATTERNS.some((re) => re.test(hostname))) {
    scamRisk = true;
    warnings.push(
      `Lookalike domain "${hostname}" is not an official .gov.in or .nic.in portal.`
    );
  }

  return {
    ok: true,
    url: parsed,
    platform,
    warnings,
    scamRisk,
  };
}
