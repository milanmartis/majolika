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
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MegaMenuModule } from 'primeng/megamenu';

import { LOCALE_ID, ApplicationConfig } from '@angular/core';
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

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([noCacheInterceptor, localeInterceptor]),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor,  multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },

    importProvidersFrom(
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useFactory: createTranslateLoader, deps: [HttpClient] }
      }),
      MatDialogModule,
      MatSnackBarModule,
      MegaMenuModule
    ),

    { provide: LOCALE_ID, useValue: 'sk' },
    { provide: 'API_URL', useValue: environment.apiUrl },
    { provide: 'FRONTEND_URL', useValue: environment.frontendUrl },
  ]
};

const bootstrap = () => bootstrapApplication(AppComponent, serverConfig);
export default bootstrap;
