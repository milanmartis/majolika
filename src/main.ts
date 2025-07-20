// src/main.ts

import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { MegaMenuModule } from 'primeng/megamenu';
import { MatDialogModule } from '@angular/material/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';





import {
  TranslateModule,
  TranslateLoader,
  TranslateService,
  TranslateStore,
  TranslateCompiler,
  TranslateFakeCompiler
} from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppComponent } from 'app/app.component';
import { routes } from 'app/app.routes';
import { LanguageService } from 'app/services/language.service';
import { AuthInterceptor } from 'app/interceptors/auth.interceptor';

import { environment } from './environments/environment';
import { provideServiceWorker } from '@angular/service-worker';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}

bootstrapApplication(AppComponent, {
  providers: [
    // 1) HttpClient + DI-based interceptors
    provideHttpClient(withInterceptorsFromDi()),

    // 2) Náš AuthInterceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },

    // 3) Router
    provideRouter(routes),

    // 4) Browser Animations (iba raz!)
    provideAnimations(),

    // 5) Import modulov via importProvidersFrom
    importProvidersFrom(
      // ngx-translate
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient],
        }
      }),
      // Angular Material dialog
      MatDialogModule,
      // PrimeNG MegaMenu
      MegaMenuModule
    ),

    // 6) Translate services & compiler
    TranslateService,
    TranslateStore,
    BrowserAnimationsModule,
    { provide: TranslateCompiler, useClass: TranslateFakeCompiler },

    // 7) Aplikácia-špecifické služby
    LanguageService,

    // 8) Konštanty pre API a frontend URL
    { provide: 'API_URL', useValue: environment.apiUrl },
    { provide: 'FRONTEND_URL', useValue: environment.frontendUrl }, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ]
})
  .catch(err => console.error('Angular sa nespustil:', err));
