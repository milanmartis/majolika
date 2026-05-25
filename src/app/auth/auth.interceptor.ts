//app/auth/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { throwError } from 'rxjs';

// Pomocná funkcia: načítaj platný (neexpirovaný) token, inak null
function getValidTokenFromStorage(platformId: Object): string | null {
  if (!isPlatformBrowser(platformId)) return null;

  let token: string | null = null;
  try { token = localStorage.getItem('jwt'); } catch {}

  if (!token) return null;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) throw new Error('Bad JWT format');
    const payload = JSON.parse(atob(payloadBase64));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && payload.exp > now) {
      return token; // platný token
    }
  } catch {
    // ignoruj, považuj za neplatný
  }

  // expirovaný alebo chybný -> cleanup
  try { localStorage.removeItem('jwt'); } catch {}
  return null;
}

// Zistí, či v storage existuje token, ktorý je expirovaný (pre "tvrdý" blok)
function hasExpiredToken(platformId: Object): boolean {
  if (!isPlatformBrowser(platformId)) return false;

  let token: string | null = null;
  try { token = localStorage.getItem('jwt'); } catch {}
  if (!token) return false;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    const payload = JSON.parse(atob(payloadBase64));
    const now = Math.floor(Date.now() / 1000);
    return !!payload?.exp && payload.exp <= now;
  } catch {
    return true;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // 1) Ak JE v storage token a JE EXPIROVANÝ -> blokni úplne (aj public)
  if (hasExpiredToken(platformId)) {
    // tu môžeš pridať napr. event/logiku na odhlásenie/redirect
    // router.navigate(['/login']);  // ak chceš presmerovať
    const err = new HttpErrorResponse({
      status: 401,
      statusText: 'TokenExpired',
      url: req.url,
      error: { message: 'JWT expired' }
    });
    return throwError(() => err);
  }

  // 2) Ak je token platný, pripoj ho; ak nie je, pošli požiadavku bez Authorization
  const validToken = getValidTokenFromStorage(platformId);
  const cloned = validToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${validToken}` } })
    : req.clone({ setHeaders: { Authorization: '' }, withCredentials: false });

  return next(cloned);
};
