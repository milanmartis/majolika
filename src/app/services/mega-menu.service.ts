// src/app/services/mega-menu.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MegaMenuService {
  /** Interný BehaviorSubject, ktorý drží, či je meganav otvorené (true) alebo zatvorené (false). */
  private _isOpen$ = new BehaviorSubject<boolean>(false);

  /** Verejne dostupné Observable, do ktorého sa môžu subscribe-ovať komponenty. */
  public isOpen$: Observable<boolean> = this._isOpen$.asObservable();

  /** ID timeoutu, ak je naplánované oneskorené zatvorenie alebo toggle. */
  private megaTimeoutId: number | null = null;

  /**
   * Okamžite otvorí meganav a zruší akékoľvek naplánované zatvorenie/toggle.
   */
  open(): void {
    if (this.megaTimeoutId !== null) {
      clearTimeout(this.megaTimeoutId);
      this.megaTimeoutId = null;
    }
    this._isOpen$.next(true);
  }

  /**
   * Naplánuje zatvorenie meganav-u za 1000 ms. Ak sa v tom čase zavolá open() alebo cancel(),
   * tento timeout sa zruší.
   */
  close(): void {
    if (this.megaTimeoutId !== null) {
      clearTimeout(this.megaTimeoutId);
    }
    this.megaTimeoutId = window.setTimeout(() => {
      this._isOpen$.next(false);
      this.megaTimeoutId = null;
    }, 100);
  }

  /**
   * Prepne (toggle) stav meganav-u s oneskorením 1 sekunda.  
   * Ak koncom tej sekundy dôjde k ďalšiemu volaniu open()/close()/toggle(), timeout sa zruší 
   * a naplánuje sa nový.
   */
  toggle(): void {
    if (this.megaTimeoutId !== null) {
      clearTimeout(this.megaTimeoutId);
    }
    this.megaTimeoutId = window.setTimeout(() => {
      const current = this._isOpen$.getValue();
      this._isOpen$.next(!current);
      this.megaTimeoutId = null;
    }, 1000);
  }

  /**
   * Zruší akýkoľvek naplánovaný timeout (či už na close alebo toggle).
   * Voláme ho napr. keď používateľ priamo vstúpi do meganav-u myšou.
   */
  cancel(): void {
    if (this.megaTimeoutId !== null) {
      clearTimeout(this.megaTimeoutId);
      this.megaTimeoutId = null;
    }
  }
}
