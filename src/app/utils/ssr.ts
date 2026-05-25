// src/app/utils/ssr.ts
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export function isBrowser(): boolean {
  const platformId = inject(PLATFORM_ID);
  return isPlatformBrowser(platformId);
}

export function getLS(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLS(key: string, val: string): void {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    window.localStorage.setItem(key, val);
  } catch {}
}
