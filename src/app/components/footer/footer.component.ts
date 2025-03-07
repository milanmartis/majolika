import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router, NavigationStart  } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { fadeInOutAnimation } from 'app/animations/route.animations';

@Component({
  selector: 'app-footer',
  standalone: true, 
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {
  currentLang: string = 'sk'; // Predvolený jazyk
  imgState = 'hidden'; // Počiatočný stav obrázka
  // showLogo: boolean = true;

  constructor(private languageService: LanguageService, private router: Router) {
    // this.router.events.subscribe(event => {
    //   if (event instanceof NavigationStart) {
    //     this.showLogo = false; // Skryje logo pri kliknutí na odkaz
    //     setTimeout(() => this.showLogo = true, 600); // Znovu zobrazí po animácii
    //   }
    // });
  }

  get showLogo(): boolean {
    return this.router.url !== '/'; // Skryje logo iba na home stránke
  }

  ngOnInit(): void {
    this.currentLang = this.languageService.getCurrentLanguage();

    
    // ✅ Animované zobrazenie loga po 300ms
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