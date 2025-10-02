import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLang: string = 'en';

  private lang$ = new BehaviorSubject<string>(this.currentLang);
  langChanged$ = this.lang$.asObservable();

  // SSR guardy
  private platformId = inject(PLATFORM_ID);
  private get isBrowser() { return isPlatformBrowser(this.platformId); }
  private get storage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }

  constructor(private translate: TranslateService, private router: Router) {
    // čítanie storage len na klientovi, fallback na 'sk'
    this.currentLang = this.storage?.getItem('language') || 'sk';
    this.translate.use(this.currentLang);
    this.lang$.next(this.currentLang);
  }

  changeLanguage(lang: string) {
    if (lang === this.currentLang) return; // ak je jazyk rovnaký, nič nerob

    this.currentLang = lang;
    this.translate.use(lang);
    this.storage?.setItem('language', lang);
    this.lang$.next(lang);

    // Presmeruj na root page len v prehliadači
    if (this.isBrowser) {
      this.router.navigateByUrl('/');
    }
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }
}
