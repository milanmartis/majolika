// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideHttpClient,
  withInterceptors,          // 👈 DOPLŇ TOTO
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { MegaMenuModule } from 'primeng/megamenu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateLoader, TranslateService, TranslateStore, TranslateCompiler, TranslateFakeCompiler } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppComponent } from 'app/app.component';
import { routes } from 'app/app.routes';
import { LanguageService } from 'app/services/language.service';
import { AuthInterceptor } from 'app/interceptors/auth.interceptor';
import { noCacheInterceptor } from 'app/interceptors/no-cache.interceptor'; // 👈 DOPLŇ

import { environment } from './environments/environment';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeSk from '@angular/common/locales/sk';
import localeEn from '@angular/common/locales/en';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}
registerLocaleData(localeEn, 'en');
registerLocaleData(localeSk, 'sk');
registerLocaleData(localeDe, 'de');

bootstrapApplication(AppComponent, {
  providers: [
    // Funkčný interceptor + DI interceptory
    provideHttpClient(
      withInterceptors([noCacheInterceptor]), // 👈 tu ho pridáš
      withInterceptorsFromDi()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

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

    TranslateService,
    TranslateStore,
    { provide: TranslateCompiler, useClass: TranslateFakeCompiler },
    LanguageService,
    { provide: LOCALE_ID, useValue: 'sk' },
    { provide: 'API_URL', useValue: environment.apiUrl },
    { provide: 'FRONTEND_URL', useValue: environment.frontendUrl },

    provideServiceWorker('ngsw-worker.js', {
      // enabled: !isDevMode(),
      // registrationStrategy: 'registerWhenStable:30000'
      enabled: environment.production,
      registrationStrategy: 'registerImmediately'
    })
  ]
}).then(appRef => {
  const sw = appRef.injector.get(SwUpdate, null);
  if (sw) {
    // okamžitý prechod na novú verziu
    sw.versionUpdates.subscribe(e => {
      if (e.type === 'VERSION_READY') {
        sw.activateUpdate().then(() => location.reload());
      }
    });
    // voliteľné: pravidelne skontroluj novú verziu
    // setInterval(() => sw.checkForUpdate(), 60_000);
  }}).catch(err => console.error('Angular sa nespustil:', err));
