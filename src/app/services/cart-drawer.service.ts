import { Injectable } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';

@Injectable({ providedIn: 'root' })
export class CartDrawerService {
  private drawer!: MatSidenav;

  /** Nastaví referenciu na MatSidenav */
  set drawerRef(sidenav: MatSidenav) {
    this.drawer = sidenav;
  }

  /** Otvorí bočný panel */
  open(): void {
    if (!this.drawer) {
      console.warn('CartDrawerService: drawerRef not set');
      return;
    }
    this.drawer.open();
  }

  /** Zatvorí bočný panel */
  close(): void {
    if (!this.drawer) {
      console.warn('CartDrawerService: drawerRef not set');
      return;
    }
    this.drawer.close();
  }
}
