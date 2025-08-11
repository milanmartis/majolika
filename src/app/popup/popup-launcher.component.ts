import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { PopupService, Popup } from 'app/services/popup.service';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-popup-launcher',
  standalone: true,
  imports: [ CommonModule, TranslateModule ],
  templateUrl: './popup-launcher.component.html',
  styleUrls: ['./popup-launcher.component.css'],
  animations: [
    trigger('slideIn', [
      transition('void => *', [
        style({ transform: 'translateX(100%) translateY(-50%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0) translateY(-50%)', opacity: 1 }))
      ]),
      transition('* => void', [
        animate('200ms ease-in', style({ transform: 'translateX(100%) translateY(-50%)', opacity: 0 }))
      ]),
    ])
  ]
})
export class PopupLauncherComponent implements OnInit {
  popup: Popup | null = null;
  isOpen = false;
  private readonly STORAGE_KEY = 'popupClosedTime';

  constructor(
    private popupService: PopupService,
    private router: Router
  ) {}

  goToLink(): void {
    // 1) zavri popup
    this.close();

    // 2) naviguj cez Angular router
    //    popup.url_link je napr. "eshop/darcekovy-poukaz-vaza-a-pohar"
    this.router.navigateByUrl('/' + this.popup!.url_link);
  }

  ngOnInit(): void {
    this.popupService.getActivePopups().subscribe(list => {
      if (!list.length) return;
      this.popup = list[0];
      if (this.canShowNow()) {
        setTimeout(() => this.open(), 5000);
      }
    });
  }

firstImageUrl(): string {
  if (!this.popup?.media?.length) {
    return '';
  }
  const m = this.popup.media[0];

  // Strapi vráti pod `formats` rôzne varianty obrázka
  const large = (m as any).formats?.large;
  if (large && large.url) {
    // ak je to ôk, použime full URL
    return large.url.startsWith('http')
      ? large.url
      : `${environment.apiUrl}${large.url}`;
  }

  // fallback na pôvodnú URL (napr. originál)
  return m.url.startsWith('http')
    ? m.url
    : `${environment.apiUrl}${m.url}`;
}

  private canShowNow(): boolean {
    const ts = localStorage.getItem(this.STORAGE_KEY);
    if (!ts) return true;
    const closedAt = new Date(ts);
    const hoursPassed = (Date.now() - closedAt.getTime()) / (1000 * 60 * 60);
    return hoursPassed >= 24;
  }

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    localStorage.setItem(this.STORAGE_KEY, new Date().toISOString());
  }
}
