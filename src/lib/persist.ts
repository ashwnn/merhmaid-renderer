/**
 * Tiny persistence helpers: localStorage for the working document and a URL
 * hash payload so a diagram can be shared with a link.
 */

import { normalizeSettings, type Settings } from "@/lib/settings";

const STORAGE_PREFIX = "merhmaid:";
const VERSION = 1;

export const STORAGE_KEYS = {
  source: `${STORAGE_PREFIX}source`,
  settings: `${STORAGE_PREFIX}settings`,
  theme: `${STORAGE_PREFIX}theme`,
} as const;

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota). Never fatal.
  }
}

export function readSettings(): Settings | null {
  const raw = readStorage(STORAGE_KEYS.settings);
  if (!raw) return null;
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Share links
 * ------------------------------------------------------------------ */

export interface SharePayload {
  v: number;
  s: string;
  t?: Settings["theme"];
  l?: Settings["look"];
  d?: Settings["direction"];
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShareLink(source: string, settings: Settings): string {
  const payload: SharePayload = {
    v: VERSION,
    s: source,
    t: settings.theme,
    l: settings.look,
    d: settings.direction,
  };
  const hash = `#d=${toBase64Url(JSON.stringify(payload))}`;
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${hash}`;
}

export interface DecodedShare {
  source: string;
  settings: Partial<Settings>;
}

export function decodeShareLink(hash: string): DecodedShare | null {
  const match = /(?:^|[#&])d=([A-Za-z0-9\-_]+)/.exec(hash);
  if (!match) return null;
  try {
    const payload = JSON.parse(fromBase64Url(match[1])) as SharePayload;
    if (typeof payload?.s !== "string") return null;
    return {
      source: payload.s,
      settings: {
        ...(payload.t ? { theme: payload.t } : {}),
        ...(payload.l ? { look: payload.l } : {}),
        ...(payload.d ? { direction: payload.d } : {}),
      },
    };
  } catch {
    return null;
  }
}

export function clearShareHash(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}
