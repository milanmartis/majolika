import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  /** Jednoduchá in-memory cache (kľúč = plná URL s query) */
  private cache = new Map<string, { t: number; resp: HttpResponse<any> }>();
  /** TTL v milisekundách (default 60s) */
  private ttlMs = 60_000;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Cache len GET požiadavky
    if (req.method !== 'GET') {
      return next.handle(req);
    }

    // Možnosť vypnúť cache per-request: set header 'x-skip-cache': 'true'
    if (req.headers.get('x-skip-cache') === 'true') {
      return next.handle(req);
    }

    const key = req.urlWithParams;
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.t < this.ttlMs) {
      // Vráť klon cachovanej odpovede
      return of(cached.resp.clone());
    }

    // Inak pokračuj na sieť a ulož čerstvú odpoveď do cache
    return next.handle(req).pipe(
      tap(ev => {
        if (ev instanceof HttpResponse) {
          this.cache.set(key, { t: now, resp: ev });
        }
      }),
      // Zdieľaj rovnakú pending odpoveď medzi viaceré subscribery
      shareReplay(1)
    );
  }
}
