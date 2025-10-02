// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,      
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom, isDevMode, ApplicationRef } from '@angular/core';
import { MegaMenuModule } from 'primeng/megamenu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateLoader, TranslateService, TranslateStore, TranslateCompiler, TranslateFakeCompiler } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { localeInterceptor } from 'app/interceptors/locale.interceptor';

import { AppComponent } from 'app/app.component';
import { routes } from 'app/app.routes';
import { LanguageService } from 'app/services/language.service';
import { AuthInterceptor } from 'app/interceptors/auth.interceptor';
import { noCacheInterceptor } from 'app/interceptors/no-cache.interceptor'; // 👈 DOPLŇ

import { environment } from './environments/environment';
import { provideServiceWorker, SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeSk from '@angular/common/locales/sk';
import localeEn from '@angular/common/locales/en';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';
import { filter } from 'rxjs/operators';
import { CacheInterceptor } from 'app/interceptors/cache.interceptor';


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

    provideServiceWorker('ngsw-worker.js', {
      // enabled: !isDevMode(),
      // registrationStrategy: 'registerWhenStable:30000'
      enabled: environment.production,
      registrationStrategy: 'registerImmediately'
    })
  ]
}).then((appRef: ApplicationRef) => {
  const swUpdate = appRef.injector.get(SwUpdate, null);

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
