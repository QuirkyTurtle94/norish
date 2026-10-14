import { z } from "zod";

import type { VideoPlatform } from "./types";

const urlSchema = z.url();

/** Whether the URL's host is one of `domains` or a subdomain of one (`instagram.com.example.net` is neither). */
function isOnDomain(url: string, ...domains: string[]): boolean {
  const hostname = URL.parse(url)?.hostname.toLowerCase();

  return (
    !!hostname && domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  );
}

/**
 * Check if URL is from Instagram.
 */
export function isInstagramUrl(url: string): boolean {
  return isOnDomain(url, "instagram.com");
}

/**
 * Check if URL is from Facebook.
 */
export function isFacebookUrl(url: string): boolean {
  return isOnDomain(url, "facebook.com", "fb.watch");
}

/**
 * Check if URL is from YouTube.
 */
export function isYouTubeUrl(url: string): boolean {
  return isOnDomain(url, "youtube.com", "youtu.be");
}

/**
 * Detect the video platform from a URL.
 * @throws ZodError if the URL is invalid
 */
export function detectPlatform(url: string): VideoPlatform {
  urlSchema.parse(url);

  if (isInstagramUrl(url)) return "instagram";
  if (isFacebookUrl(url)) return "facebook";
  if (isYouTubeUrl(url)) return "youtube";

  return "generic";
}
