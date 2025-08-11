import { Injectable } from '@angular/core';
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

  constructor(private translate: TranslateService, private router: Router) {
    this.currentLang = localStorage.getItem('language') || 'sk';
    this.translate.use(this.currentLang);
    this.lang$.next(this.currentLang);
  }

  changeLanguage(lang: string) {
    if (lang === this.currentLang) return; // ak je jazyk rovnaký, nič nerob

    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem('language', lang);
    this.lang$.next(lang);

    // Presmeruj na root page
    this.router.navigateByUrl('/');
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }
}
