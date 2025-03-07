import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateLoader, TranslateModule, TranslateService, TranslateStore, TranslateCompiler, TranslateFakeCompiler, TranslateParser } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from 'app/app.routes';
import { AppComponent } from 'app/app.component';
import { LanguageService } from 'app/services/language.service';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json'); // Správna cesta
}

const translateProviders = TranslateModule.forRoot({
  loader: {
    provide: TranslateLoader,
    useFactory: createTranslateLoader,
    deps: [HttpClient]
  }
}).providers || []; // ✅ Ak je `providers` `undefined`, použije sa prázdne pole.

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    provideRouter(routes),
    

    ...translateProviders, // ✅ Bezpečné rozbalenie `providers`
    
    { provide: TranslateCompiler, useClass: TranslateFakeCompiler },
    TranslateService,
    TranslateStore,
    LanguageService
  ]
}).catch(err => console.error("Angular sa nespustil:", err));
