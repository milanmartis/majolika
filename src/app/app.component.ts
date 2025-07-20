// src/app/app.component.ts

import {
  Component,
  OnInit,
  ElementRef,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { skip } from 'rxjs/operators';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { CartService } from 'app/services/cart.service';
import { ColorPickerComponent, ColorPickerDirective } from 'ngx-color-picker';

import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { slideLeftAnimation } from 'app/animations/route.animations';
import { HeaderComponent } from 'app/components/header/header.component';
// import { FooterComponent } from 'app/components/footer/footer.component';
import { PopupLauncherComponent } from './popup/popup-launcher.component';
import { CartComponent } from 'app/pages/cart/cart.component';   // ← import here
import { MatDialogModule } from '@angular/material/dialog';
// import { CartDrawerService } from 'app/services/cart-drawer.service';
import { ThemeService } from 'app/services/theme.service';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
// import { HeadingBlockComponent } from 'app/blocks/heading-block/heading-block.component';
// import { LinkBlockComponent } from 'app/blocks/link-block/link-block.component';
// import { VideoBlockComponent } from 'app/blocks/video-block/video-block.component';
// import { ImageBlockComponent } from 'app/blocks/image-block/image-block.component';
// import { TextBlockComponent } from 'app/blocks/text-block/text-block.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,           // potrebné kvôli <router-outlet>
    HeaderComponent,
    // FooterComponent,
    PopupLauncherComponent,
    CartComponent,
    MatDialogModule,          // ← sem
    // ColorPickerComponent,
   // ColorPickerDirective,
    // CartDrawerService
    // HeadingBlockComponent,
    // LinkBlockComponent,
    // ImageBlockComponent,
    // TextBlockComponent,
    // VideoBlockComponent

  ],
  animations: [
    slideLeftAnimation,      // tento trigger animuje celý blok
    trigger('slideIn', [
      state('closed', style({ transform: 'translateX(100%)' })),
      state('open',   style({ transform: 'translateX(0)'     })),
      transition('closed => open',   animate('300ms ease-out')),
      transition('open   => closed', animate('200ms ease-in')),
    ])],
  template: `
    <!-- LOADER (zostane viditeľný 2 sekundy, potom sa schová) -->
    <div *ngIf="isLoading" class="loading-container">
      <div class="row">
        <div class="col-12">
          <img src="/assets/img/dekor.png"
               style="width:120px;display:block;margin:auto;text-align:center;">
          <small style="width:120px;display:block;margin:auto;text-align:center;
                        font-weight:600;color: #2944ba;">
            Slovenská ľudová majolika
          </small><br>
        </div>
        <div class="col-12">
          <div style="display:block;margin:auto;text-align:center;" class="spinner"></div>
        </div>
      </div>
    </div>

    <!-- HLAVNÝ OBAL S ANIMÁCIOU (všetko vrátane header + popup + outlet + footer) -->
    <div *ngIf="!isLoading"
         [@routeAnimations]="prepareRoute(outlet)"
         class="app-wrapper">
      <!-- 1) Header -->
      <app-header [isAtTop]="isAtTop" [hidden]="headerHidden"></app-header>
<br>
      <!-- 2) Popup (ak je) -->
      <app-popup-launcher></app-popup-launcher>
  
  <div
  class="slide-panel"
  [class.open]="isOpen"
  (clickOutsidePanel)="onOutsideClick()"
>
  <!-- handle -->
  <!-- <div class="panel-handle" (click)="togglePanel($event)">
    <span>|||</span>
  </div> -->

  <!-- your original picker -->
  <!-- <div class="theme-picker">
    <div class="palette">
      <input
        class="swatch"
        [(colorPicker)]="currentColor"
        [cpPresetColors]="palette"
        [style.background]="currentColor"
        (colorPickerChange)="onSelect($event)"
        [cpOutputFormat]="'hex'"
      />
    </div>
    <br />
    <fieldset>
      <div *ngFor="let corner of corners">
        <input
          style="cursor:pointer;"
          type="radio"
          [id]="'corner-' + corner"
          name="borderRadius"
          [value]="corner"
          [checked]="currentCorner === corner"
          (change)="onChecked(corner)"
        />
        <label [for]="'corner-' + corner">
          _{{ corner }}
        </label>
      </div>
    </fieldset>
  </div> -->
</div>
      <!-- 3) Hlavný obsah (router-outlet) -->
      <router-outlet #outlet="outlet"></router-outlet>
<!-- slide-out panel -->
<aside
  class="cart-sidebar"
  [class.open]="isCartOpen"
  (@slideIn.done)="onAnimationDone()"
  [@slideIn]="isCartOpen ? 'open' : 'closed'"
>
  <button class="close-btn" (click)="closeCart()">✕</button>
  <app-cart (productClicked)="closeSidebar()"></app-cart>
</aside>
<div
  class="backdrop"
  *ngIf="isCartOpen"
  (click)="closeCart()"
></div>
      <!-- 4) Footer -->
      <!-- <app-footer></app-footer> -->
    </div>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  isOpen = false;


  corners = [0];      // => px values
  // corners = [0, 16, 32];      // => px values
  currentCorner!: number;
  isCartOpen = false;
  palette: string[] = [
    '#3498db', '#2ecc71', '#e74c3c',
    '#9b59b6', '#f1c40f', '#1abc9c',
    '#34495e', '#e67e22', '#7f8c8d'
  ];
  currentColor = '';
  isLoading = true;
  headerHidden = false;
  isAtTop = true;
  isMobile = false;
  private lastScrollY = 0;
  private scrollThreshold = 50;

  constructor(
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private cart: CartService,
    private theme: ThemeService,
    private el: ElementRef,
    private bo: BreakpointObserver
  ) {
    // Otvoriť sidebar pri prvom pridaní položky do košíka
    this.cart.cart$
      .pipe(skip(1))
      .subscribe(rows => {
        if (rows.length) {
          this.openCart();
        }
      });

    // Otvoriť sidebar aj pri manuálnom volaní openCart()
    this.cart.openSidebar$.subscribe(() => this.openCart());


      this.bo
        .observe([Breakpoints.HandsetPortrait, Breakpoints.HandsetLandscape])
        .subscribe(result => (this.isMobile = result.matches));
  }
  
  onOutsideClick() {
    this.isOpen = false;
  }

  togglePanel(evt: MouseEvent) {
    evt.stopPropagation();    // prevent immediate outside-click handler
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(evt: MouseEvent) {
    // if click happened outside of this component’s root element
    if (
      this.isOpen &&
      !this.el.nativeElement.contains(evt.target)
    ) {
      this.isOpen = false;
    }
  }

  closeSidebar() {
    this.isCartOpen = false;
  }
  openCart()  { this.isCartOpen = true;  }
  closeCart() { this.isCartOpen = false; }

  onAnimationDone() {
    // prípadne niečo po dojazde animácie
  }

  ngOnInit(): void {
    // simulácia načítania
    this.lastScrollY = window.scrollY;
    this.isAtTop = window.scrollY <= this.scrollThreshold;

    const stored = localStorage.getItem('color-primary');
    if (stored) {
      this.currentColor = stored;
      this.theme.setColor('--color-primary', stored);
    } else {
      // 2) Ak nič nebolo uložené, načítaj default (alebo prvu z palety)
      this.currentColor = this.theme.getColor('--color-primary') || this.palette[0];
      this.theme.setColor('--color-primary', this.currentColor);
    }

    const saved = localStorage.getItem('border-radius');
    this.currentCorner = saved !== null
      ? +saved
      : this.corners[0];           // default 0px

    this.theme.setBorderRadius(`${this.currentCorner}px`);


    setTimeout(() => {
      this.isLoading = false;
      this.cdRef.detectChanges();
    }, 2000);
  }

  onPrimaryChange(newColor: string) {
    this.currentColor = newColor;
    this.theme.setColor('--color-primary', newColor);
  }
  onSelect(color: string) {
    this.currentColor = color;
    this.theme.setColor('--color-primary', color);
    localStorage.setItem('color-primary', color);

  }
  onChecked(corner: number) {
    this.currentCorner = corner;
    this.theme.setBorderRadius(`${corner}px`);
    localStorage.setItem('border-radius', corner.toString());
  }

  // Vráti hodnotu z route.data['animation'] pre daný outlet
  prepareRoute(outlet: RouterOutlet) {
    return outlet &&
           outlet.activatedRouteData &&
           outlet.activatedRouteData['animation'];
  }

  @HostListener('window:scroll')
  onWindowScroll() {
   // if (!this.isMobile) return;
    const currentY = window.scrollY;
    this.isAtTop = currentY <= this.scrollThreshold;

    if (!this.isAtTop) {
      if (currentY > this.lastScrollY && currentY > this.scrollThreshold) {
        // scroll nadol: schovať header
        this.headerHidden = false;
      } else if (currentY < this.lastScrollY) {
        // scroll nahor: zobraziť header
        this.headerHidden = false;
      }
    } else {
      // pri vrchu stránky vždy zobraziť header
      this.headerHidden = false;
    }

    this.lastScrollY = currentY;
  }
}
