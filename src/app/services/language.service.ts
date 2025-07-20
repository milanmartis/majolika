import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLang: string = 'en'; // Predvolený jazyk

  constructor(private translate: TranslateService) {
    // Nastavíme predvolený jazyk pri inicializácii
    this.currentLang = localStorage.getItem('language') || 'sk';
    this.translate.use(this.currentLang);
  }

  changeLanguage(lang: string) {
    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem('language', lang); // Uloženie do localStorage
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }
}
