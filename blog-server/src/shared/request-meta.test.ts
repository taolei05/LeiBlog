import { describe, expect, test } from "bun:test";

import { getRequestMeta, isPrivateIp } from "./request-meta";

describe("client IP trust boundary", () => {
  test("ignores forwarded headers from untrusted peers", () => {
    expect(
      getRequestMeta({
        requestIp: "203.0.113.9",
        headers: {
          "x-forwarded-for": "198.51.100.1",
          "x-real-ip": "198.51.100.2",
        },
        trustedProxyIps: ["127.0.0.1"],
      }).ip,
    ).toBe("203.0.113.9");
  });

  test("does not accept spoofed prefixes forwarded by a trusted proxy", () => {
    expect(
      getRequestMeta({
        requestIp: "127.0.0.1",
        headers: {
          "x-forwarded-for": "198.51.100.1, 203.0.113.9",
        },
        trustedProxyIps: ["127.0.0.1"],
      }).ip,
    ).toBe("203.0.113.9");
  });

  test("walks a trusted proxy chain from right to left", () => {
    expect(
      getRequestMeta({
        requestIp: "127.0.0.1",
        headers: {
          "x-forwarded-for": "198.51.100.1, 203.0.113.9, 10.0.0.2",
        },
        trustedProxyIps: ["127.0.0.1", "10.0.0.0/8"],
      }).ip,
    ).toBe("203.0.113.9");
  });

  test("stops at malformed proxy hops instead of skipping them", () => {
    expect(
      getRequestMeta({
        requestIp: "127.0.0.1",
        headers: {
          "x-forwarded-for": "198.51.100.1, invalid",
        },
        trustedProxyIps: ["127.0.0.1"],
      }).ip,
    ).toBe("127.0.0.1");
  });

  test("normalizes IPv4-mapped peers and private addresses", () => {
    expect(
      getRequestMeta({
        requestIp: "::ffff:127.0.0.1",
        headers: {
          "x-forwarded-for": "203.0.113.9",
        },
        trustedProxyIps: ["127.0.0.1"],
      }).ip,
    ).toBe("203.0.113.9");
    expect(isPrivateIp("::ffff:c0a8:101")).toBe(true);
    expect(isPrivateIp("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isPrivateIp("fe80::1%lo0")).toBe(true);
  });
});
