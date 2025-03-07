import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationStart } from '@angular/router';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { fadeInOutAnimation } from 'app/animations/route.animations';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FormsModule], // ✅ Pridaj FormsModule
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  animations: [fadeInOutAnimation]
})
export class HeaderComponent implements OnInit {
  currentLang: string = 'sk'; // Predvolený jazyk
  imgState = 'hidden'; // Počiatočný stav obrázka
  searchQuery: string = ''; // Vyhľadávací text
  // isDropdownOpen: boolean = false; // Stavy pre dropdown

  isSidebarOpen: boolean = false;

  categories = [
    { name: 'CATEGORIES.HOME', link: '/' },
    { name: 'CATEGORIES.PRODUCTS', link: '/eshop' },
    { name: 'CATEGORIES.WORKSHOPS', link: '/dielne' },
    { name: 'CATEGORIES.TRADITION', link: '/tradicia' },
    { name: 'CATEGORIES.ABOUT', link: '/' },
    { name: 'CATEGORIES.KONTAKTY', link: '/' }
  ];

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }


  constructor(private languageService: LanguageService, private router: Router) {}

  get showLogo(): boolean {
    return this.router.url !== '/'; // Skryje logo iba na domovskej stránke
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

  search() {
    console.log('Searching for:', this.searchQuery);
    // Implementuj navigáciu alebo API request na vyhľadanie obsahu
  }
  
  // toggleDropdown() {
  //   this.isDropdownOpen = !this.isDropdownOpen;
  // }
}
