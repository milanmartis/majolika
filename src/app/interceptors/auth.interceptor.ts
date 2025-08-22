// app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent,
  HttpContextToken, HttpContext
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// HttpContext flagy (voliteľné použitie pri konkrétnych requestoch)
export const SKIP_AUTH       = new HttpContextToken<boolean>(() => false);
export const FORCE_API_TOKEN = new HttpContextToken<boolean>(() => false);

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Aplikuj len na Strapi API (funguje pre absolútne aj relatívne URL)
    const isStrapi = this.isStrapiRequest(req.url, environment.apiUrl);
    if (!isStrapi || req.context.get(SKIP_AUTH)) {
      return next.handle(req);
    }

    // Neposielaj Authorization na OAuth štart/callback a local login/register
    const relPath = this.relativeApiPath(req.url, environment.apiUrl);
    const skipForEndpoints =
      /^\/connect\//.test(relPath) ||
      /^\/auth\/.+\/callback$/.test(relPath) ||
      /^\/auth\/local$/.test(relPath) ||
      /^\/auth\/local\/register$/.test(relPath);

    if (skipForEndpoints) {
      return next.handle(req);
    }

    // Neprekryvaj existujúci Authorization
    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }

    const jwt = localStorage.getItem('jwt');
    const useApiToken = !jwt && !!environment.strapiToken;
    const forceApiToken = req.context.get(FORCE_API_TOKEN);

    let authReq = req;

    if (jwt && !forceApiToken) {
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${jwt}` } });
    } else if (useApiToken || forceApiToken) {
      // POZOR: v FE používaj len PUBLIC API token, nikdy Admin token
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${environment.strapiToken}` } });
    }

    return next.handle(authReq);
  }

  /** Zistí, či URL mieri na Strapi (host + base path z environment.apiUrl) */
  private isStrapiRequest(requestUrl: string, apiBase: string): boolean {
    try {
      const req = new URL(requestUrl, window.location.origin);
      const api = new URL(apiBase, window.location.origin);
      // match host + to, že path začína base path (napr. /api)
      return req.origin === api.origin && req.pathname.startsWith(api.pathname);
    } catch {
      return false;
    }
  }

  /** Vráti path relatívnu k base API (napr. '/auth/google/callback') */
  private relativeApiPath(requestUrl: string, apiBase: string): string {
    const req = new URL(requestUrl, window.location.origin);
    const api = new URL(apiBase, window.location.origin);
    let rel = req.pathname.slice(api.pathname.length);
    if (!rel.startsWith('/')) rel = '/' + rel;
    return rel;
  }
}
