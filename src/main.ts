// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
  HttpClient
} from '@angular/common/http';
import { provideRouter, Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom, isDevMode, ApplicationRef } from '@angular/core';
import { MegaMenuModule } from 'primeng/megamenu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import {
  TranslateModule,
  TranslateLoader,
  TranslateService,
  TranslateStore,
  TranslateCompiler,
  TranslateFakeCompiler
} from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { localeInterceptor } from 'app/interceptors/locale.interceptor';

import { AppComponent } from 'app/app.component';
import { routes } from 'app/app.routes';
import { LanguageService } from 'app/services/language.service';
import { AuthInterceptor } from 'app/interceptors/auth.interceptor';
import { noCacheInterceptor } from 'app/interceptors/no-cache.interceptor';
import { CacheInterceptor } from 'app/interceptors/cache.interceptor';

import { environment } from './environments/environment';
import { provideServiceWorker, SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeSk from '@angular/common/locales/sk';
import localeEn from '@angular/common/locales/en';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';
import { filter } from 'rxjs/operators';
import { Title, Meta } from '@angular/platform-browser';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}

registerLocaleData(localeEn, 'en');
registerLocaleData(localeSk, 'sk');
registerLocaleData(localeDe, 'de');

// ===== GTM/GA – deklarácia dataLayer pre TS =====
declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Pomocná funkcia: nájde najhlbšie `data.pageType` z aktívnej routy (ak si ho nastavíš v definícii rout).
 */
function getDeepestPageTypeSnapshot(route: ActivatedRouteSnapshot | null): string | undefined {
  let current: ActivatedRouteSnapshot | null = route;
  let pageType: string | undefined;
  while (current) {
    const maybe = (current.data && (current.data as any)['pageType']) as string | undefined;
    if (maybe) pageType = maybe; // preberá vždy najhlbšie definovaný
    current = current.firstChild ?? null;
  }
  return pageType;
}

bootstrapApplication(AppComponent, {
  providers: [
    // Funkčný interceptor + DI interceptory
    provideHttpClient(
      withFetch(),
      withInterceptors([noCacheInterceptor, localeInterceptor]),
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor,  multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },

    provideRouter(routes),
    provideAnimations(),

    importProvidersFrom(
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useFactory: createTranslateLoader, deps: [HttpClient] }
      }),
      MatDialogModule,
      MatSnackBarModule,
      MegaMenuModule
    ),

    { provide: TranslateCompiler, useClass: TranslateFakeCompiler },
    LanguageService,
    { provide: LOCALE_ID, useValue: 'sk' },
    { provide: 'API_URL', useValue: environment.apiUrl },
    { provide: 'FRONTEND_URL', useValue: environment.frontendUrl },

    // SEO služby – používajú sa v AppComponent-e na nastavovanie <title> a <meta>
    Title,
    Meta,

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
      // enabled: true,                // <- dočasne natvrdo
      // registrationStrategy: 'registerImmediately'
    })
  ]
}).then((appRef: ApplicationRef) => {
  const swUpdate = appRef.injector.get(SwUpdate, null);

  // ===== SPA page_view do Google Tag Manager / GA4 =====
  const router = appRef.injector.get(Router, null);
  if (router) {
    // istota, že dataLayer existuje (GTM snippet ho má inicializovať v index.html, ale toto je bezpečné)
    window.dataLayer = window.dataLayer || [];

    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const pageType = getDeepestPageTypeSnapshot(router.routerState.snapshot.root);
        window.dataLayer.push({
          event: 'page_view',
          page_path: e.urlAfterRedirects,
          page_location: window.location.href,
          page_title: document.title,
          // voliteľné – len ak využívaš v GTM
          ...(pageType ? { page_type: pageType } : {})
        });
      });
  }

  if (swUpdate?.isEnabled) {
    // keď je k dispozícii nová verzia, aktivuj a tvrdo refreshni
    swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        swUpdate.activateUpdate().then(() => document.location.reload());
      });

    // skontroluj hneď po štarte
    swUpdate.checkForUpdate();

    // voliteľne: pravidelná kontrola (napr. raz za hodinu)
    // setInterval(() => swUpdate.checkForUpdate(), 60 * 60 * 1000);
  }
}).catch(err => console.error('Angular sa nespustil:', err));
