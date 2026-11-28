import { describe, expect, it } from "vitest";
import { validatePublicSocialUrl } from "@/lib/url-safety";

describe("validatePublicSocialUrl", () => {
  it("rejects empty or malformed URLs", () => {
    expect(validatePublicSocialUrl("").ok).toBe(false);
    expect(validatePublicSocialUrl("   ").ok).toBe(false);
    expect(validatePublicSocialUrl("not a url").ok).toBe(false);
  });

  it("rejects non-HTTP(S) schemes", () => {
    for (const bad of [
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/file",
    ]) {
      const res = validatePublicSocialUrl(bad);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects embedded credentials", () => {
    const res = validatePublicSocialUrl("https://user:pass@example.com/post");
    expect(res.ok).toBe(false);
  });

  it("rejects localhost, loopback, private IPv4, link-local metadata, and private IPv6", () => {
    const ssrfTargets = [
      "http://localhost:3000/api",
      "http://sub.localhost/test",
      "http://0.0.0.0:8080/",
      "http://127.0.0.1/admin",
      "http://127.255.0.1/status",
      "http://10.0.0.1/internal",
      "http://172.16.0.1/metadata",
      "http://172.31.255.254/internal",
      "http://192.168.1.1/router",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/loopback",
      "http://[fc00::1]/ula",
      "http://[fd12:3456:789a::1]/ula",
      "http://[fe80::1]/linklocal",
      "http://[::ffff:127.0.0.1]/mapped",
      "http://2130706433/decimal-loopback",
    ];
    for (const target of ssrfTargets) {
      const res = validatePublicSocialUrl(target);
      expect(res.ok, `Expected SSRF target to be rejected: ${target}`).toBe(false);
    }
  });

  it("allows 172.32.0.1 and public IPv4/domains", () => {
    const res = validatePublicSocialUrl("https://172.32.0.1/public");
    expect(res.ok).toBe(true);
  });

  it("classifies social and government platforms accurately", () => {
    const cases: Array<[string, string]> = [
      ["https://chat.whatsapp.com/AbCdEf123", "whatsapp"],
      ["https://wa.me/919876543210", "whatsapp"],
      ["https://www.instagram.com/p/ABC123/", "instagram"],
      ["https://www.reddit.com/r/IndianFarming/comments/abc123/crop_update/", "reddit"],
      ["https://x.com/AgriGoI/status/1234567890", "x"],
      ["https://twitter.com/IMDWeather/status/123", "x"],
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
      ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
      ["https://pmkisan.gov.in/", "gov"],
      ["https://agmarknet.nic.in/Default.aspx", "gov"],
      ["https://icar.org.in/advisory", "web"],
    ];

    for (const [url, expectedPlatform] of cases) {
      const res = validatePublicSocialUrl(url);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.platform).toBe(expectedPlatform);
        expect(res.scamRisk).toBe(false);
      }
    }
  });

  it("flags .apk downloads, URL shorteners, and lookalike phishing domains with scamRisk=true", () => {
    const risky = [
      "https://example.com/downloads/pm-kisan-update.apk",
      "https://bit.ly/free-kisan-money",
      "https://tinyurl.com/pmkisan-bonus",
      "https://t.co/xyz123",
      "https://pmkisan-yojana.com/claim",
      "https://kisan-registration-india.in/apply",
    ];
    for (const url of risky) {
      const res = validatePublicSocialUrl(url);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.scamRisk, `Expected scamRisk=true for ${url}`).toBe(true);
        expect(res.warnings.length).toBeGreaterThan(0);
      }
    }
  });
});
