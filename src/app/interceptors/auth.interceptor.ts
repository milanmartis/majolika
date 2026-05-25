// app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isStrapiRequest(req.url, environment.apiUrl)) {
      return next.handle(req);
    }

    const relPath = this.relativeApiPath(req.url, environment.apiUrl);

    // neautorizujeme auth/SSO endpointy
    if (
      /^\/connect\//.test(relPath) ||
      /^\/auth\/.+\/callback$/.test(relPath) ||
      /^\/auth\/local$/.test(relPath) ||
      /^\/auth\/local\/register$/.test(relPath)
    ) {
      return next.handle(req);
    }

    // Ak už je Authorization a je prázdny -> ZMAŽ ho. Ak je neprázdny -> nechaj tak.
    if (req.headers.has('Authorization')) {
      const val = req.headers.get('Authorization');
      if (!val) {
        req = req.clone({ headers: req.headers.delete('Authorization') });
      } else {
        return next.handle(req);
      }
    }

    // pripoj platné JWT; ak nie je platné, pošli bez Authorization
    const jwt = this.getValidTokenFromStorage();
    let authReq = req;
    if (jwt) {
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${jwt}` } });
    }

    const sentWithAuthHeader = authReq.headers.has('Authorization');

    return next.handle(authReq).pipe(
      catchError((err: any) => {
        // 401 po pokuse s JWT -> zmaž token a skús raz bez Authorization (pre public endpoints)
        if (err instanceof HttpErrorResponse && err.status === 401 && sentWithAuthHeader) {
          this.dropToken();
          const retry = authReq.clone({ headers: authReq.headers.delete('Authorization') });
          return next.handle(retry);
        }
        return throwError(() => err);
      })
    );
  }

  // --- helpers ---

  private getValidTokenFromStorage(): string | null {
    if (typeof localStorage === 'undefined') return null;

    let token: string | null = null;
    try { token = localStorage.getItem('jwt'); } catch {}
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      const now = Math.floor(Date.now() / 1000);
      if (payload?.exp && payload.exp > now) return token;
    } catch {}

    this.dropToken();
    return null;
  }

  private dropToken() {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.removeItem('jwt'); } catch {}
  }

  private isStrapiRequest(requestUrl: string, apiBase: string): boolean {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : apiBase;
      const req = new URL(requestUrl, origin);
      const api = new URL(apiBase, origin);
      return req.origin === api.origin && req.pathname.startsWith(api.pathname);
    } catch { return false; }
  }

  private relativeApiPath(requestUrl: string, apiBase: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : apiBase;
    const req = new URL(requestUrl, origin);
    const api = new URL(apiBase, origin);
    let rel = req.pathname.slice(api.pathname.length);
    if (!rel.startsWith('/')) rel = '/' + rel;
    return rel;
  }
}
