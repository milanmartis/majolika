import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { fadeInOutAnimation } from 'app/animations/route.animations';

@Component({
  selector: 'app-kontakt',
  standalone: true,  // ✅ Dôležité!
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './kontakt.component.html',
  styleUrls: ['./kontakt.component.css'],
  animations: [fadeInOutAnimation] // ✅ Pridanie animácie do komponentu

})
export class KontaktComponent {
  constructor(@Inject(LanguageService) private languageService: LanguageService) {} // ✅ Pridané @Inject()

  switchLanguage(lang: string) {
    this.languageService.changeLanguage(lang);
  }

  imgState = 'hidden'; // Počiatočný stav obrázka

  ngOnInit() {
    setTimeout(() => {
      this.imgState = 'visible'; // Po načítaní stránky sa obrázok zobrazí
    }, 300);
  }
}
