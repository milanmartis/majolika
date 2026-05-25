import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { LinkifyPipe } from 'app/pipes/linkify.pipe';

// ⬇️ newsletter komponent (ten, ktorý sme si vytvorili)
import { FooterNewsletterComponent } from './footer-newsletter.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LinkifyPipe,
    FooterNewsletterComponent, // ← pridané
  ],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
})
export class FooterComponent implements OnInit {
  currentLang = 'sk';
  imgState: 'hidden' | 'visible' = 'hidden';

  constructor(
    private languageService: LanguageService,
    private router: Router
  ) {}

  /** Skryje logo iba na home stránke */
  get showLogo(): boolean {
    return this.router.url !== '/';
  }

  ngOnInit(): void {
    this.currentLang = this.languageService.getCurrentLanguage();

    // animovaný nábeh loga
    setTimeout(() => {
      this.imgState = 'visible';
    }, 300);
  }

  switchLanguage(lang: string) {
    this.languageService.changeLanguage(lang);
    this.currentLang = lang;
  }

  isActive(lang: string): boolean {
    return this.currentLang === lang;
  }
}
