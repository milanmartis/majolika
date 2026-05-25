// src/main.server.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideServerRendering } from '@angular/platform-server';
import { importProvidersFrom } from '@angular/core';

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MegaMenuModule } from 'primeng/megamenu';

import { LOCALE_ID, ApplicationConfig, NgZone, ɵNoopNgZone as NoopNgZone } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeSk from '@angular/common/locales/sk';
import localeEn from '@angular/common/locales/en';
import localeDe from '@angular/common/locales/de';

import { routes } from './app/app.routes';
import { noCacheInterceptor } from './app/interceptors/no-cache.interceptor';
import { localeInterceptor } from './app/interceptors/locale.interceptor';
import { AuthInterceptor } from './app/interceptors/auth.interceptor';
import { CacheInterceptor } from './app/interceptors/cache.interceptor';

import { environment } from './environments/environment';

registerLocaleData(localeEn, 'en');
registerLocaleData(localeSk, 'sk');
registerLocaleData(localeDe, 'de');

export class ServerTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<Record<string, unknown>> {
    const safeLang = ['sk', 'en', 'de'].includes(lang) ? lang : 'sk';
    const candidates = [
      join(process.cwd(), 'dist/dashboard/browser/assets/i18n', `${safeLang}.json`),
      join(process.cwd(), 'src/assets/i18n', `${safeLang}.json`),
    ];

    for (const file of candidates) {
      if (!existsSync(file)) continue;

      try {
        return of(JSON.parse(readFileSync(file, 'utf8')));
      } catch {
        return of({});
      }
    }

    return of({});
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideServerRendering(),
    provideNoopAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([noCacheInterceptor, localeInterceptor]),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor,  multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },

    importProvidersFrom(
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useClass: ServerTranslateLoader }
      }),
      MatDialogModule,
      MatSnackBarModule,
      MegaMenuModule
    ),

    { provide: LOCALE_ID, useValue: 'sk' },
    { provide: NgZone, useClass: NoopNgZone },
    { provide: 'API_URL', useValue: environment.apiUrl },
    { provide: 'FRONTEND_URL', useValue: environment.frontendUrl },
  ]
};

const bootstrap = () => bootstrapApplication(AppComponent, serverConfig);
export default bootstrap;
