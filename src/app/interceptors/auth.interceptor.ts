// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // najprv skúsime JWT z localStorage (prihlásený používateľ)
    const jwt = localStorage.getItem('jwt');
    let authReq: HttpRequest<any>;

    if (jwt) {
      console.log('Using JWT for Strapi:', jwt);
      authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${jwt}` }
      });
    } else if (environment.strapiToken) {
      // fallback na statický API-token pre verejné požiadavky
      console.log('Using Strapi API token:', environment.strapiToken);
      authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${environment.strapiToken}` }
      });
    } else {
      // žiadny token → pošleme request bez Authorization
      authReq = req;
    }

    return next.handle(authReq);
  }
}
