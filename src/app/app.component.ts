import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ Musí byť importovaný
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { slideLeftAnimation } from './animations/route.animations';
import { HeaderComponent } from 'app/components/header/header.component';
import { FooterComponent } from 'app/components/footer/footer.component';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  // imports: [CommonModule, RouterOutlet], // ✅ Pridaný CommonModule
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent], // ✅ Pridaný CommonModule
  animations: [slideLeftAnimation], // ✅ Pridanie animácie
  template: `
    <div *ngIf="isLoading" class="loading-container">
      <div class="row">
        <div class="col-12">
          <img src="/assets/img/dekor.png" style="width:120px;display:block;margin:auto;text-align:center;">
          <small style="width:120px;display:block;margin:auto;text-align:center;font-weight:600;color: #2944ba;">Slovenská ľudová majolika</small><br>
        </div>
        <div class="col-12">
          <div style="display:block;margin:auto;text-align:center;" class="spinner"></div>
        </div>
      </div>
    </div>
    
    <div *ngIf="!isLoading" [@routeAnimations]="prepareRoute(o)" class="content-container">
    <app-header [ngClass]="{'tradicia-page': isHomePage}"></app-header>
    <router-outlet #o="outlet"></router-outlet>
      <app-footer></app-footer>
    </div>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  isLoading = true;
  isHomePage: boolean = false;
  touchStartY: number = 0;
  isRefreshing: boolean = false;

  constructor(private router: Router, private cdRef: ChangeDetectorRef) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isHomePage = event.url.includes('tradicia');
        document.body.classList.toggle('tradicia-mode', this.isHomePage);
        this.cdRef.detectChanges(); // ✅ Vynútenie refreshu
      }
    });
  }

  ngOnInit() {
    setTimeout(() => {
      this.isLoading = false;
    }, 2000); // ✅ Simulácia načítania (po 2s zmizne loader)
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isHomePage = event.url === '/tradicia';
        document.body.classList.toggle('tradicia-mode', this.isHomePage);
      }
    });
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.['animation'];
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    this.touchStartY = event.touches[0].clientY;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    const touchY = event.touches[0].clientY;
    if (touchY - this.touchStartY > 250 && !this.isRefreshing) { // 100px swipe down
      this.isRefreshing = true;
      location.reload();
    }
  }

  @HostListener('touchend')
  onTouchEnd() {
    this.isRefreshing = false;
  }
}
