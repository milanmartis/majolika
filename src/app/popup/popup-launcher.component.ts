import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, animate, transition } from '@angular/animations';
import { PopupService, Popup } from 'app/services/popup.service';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';

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
export class PopupLauncherComponent implements OnInit, OnDestroy {
  popup: Popup | null = null;
  isOpen = false;
  currentIndex = 0;
  readonly SLIDE_MS = 5000;          // interval medzi snímkami
  private timerId: any = null;
  private readonly STORAGE_KEY = 'popupClosedTime';

  constructor(
    private popupService: PopupService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.popupService.getActivePopups().subscribe(list => {
      if (!list.length) return;
      this.popup = list[0];

      // reset index pri novej popup definícii
      this.currentIndex = 0;

      if (this.canShowNow()) {
        setTimeout(() => this.open(), 5000);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopSlideshow();
  }

  get imageUrls(): string[] {
    if (!this.popup?.media?.length) return [];
    return this.popup.media
      .map(m => {
        const large = (m as any).formats?.large;
        const url = large?.url ?? m.url;
        return url?.startsWith('http') ? url : `${environment.apiUrl}${url}`;
      })
      .filter(Boolean);
  }

  goToLink(): void {
    this.close();
    this.router.navigateByUrl('/' + this.popup!.url_link);
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
    this.startSlideshow(); // spustiť len keď otvorené
  }

  close(): void {
    this.isOpen = false;
    this.stopSlideshow();
    localStorage.setItem(this.STORAGE_KEY, new Date().toISOString());
  }

  private startSlideshow(): void {
    // spúšťame len ak je viac ako 1 obrázok
    if (this.timerId || this.imageUrls.length < 2) return;

    // (voliteľné) prednačítanie
    this.imageUrls.forEach(u => { const img = new Image(); img.src = u; });

    this.timerId = setInterval(() => {
      // ak popup medzičasom zatvorený, pauzni
      if (!this.isOpen || this.imageUrls.length < 2) return;
      this.currentIndex = (this.currentIndex + 1) % this.imageUrls.length;
    }, this.SLIDE_MS);
  }

  private stopSlideshow(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
