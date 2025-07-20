/* src/app/theme.service.ts */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Všeobecná metóda: zmení ľubovoľnú CSS premennú */
  setProperty(property: string, value: string): void {
    document.documentElement.style.setProperty(property, value);
  }

  /** Všeobecná metóda: načíta hodnotu ľubovoľnej CSS premennej */
  getProperty(property: string): string {
    return getComputedStyle(document.documentElement)
             .getPropertyValue(property)
             .trim();
  }

  /** Špecifický helper na border-radius */
  setBorderRadius(radius: string): void {
    const num = parseFloat(radius);
    // zachovaj akúkoľvek jednotku na konci, napr. "px", "em", "rem"
    const unitMatch = radius.match(/[^0-9.\-]+$/);
    const unit = unitMatch ? unitMatch[0] : 'px';

    this.setProperty('--corners',  `${num}${unit}`);
    this.setProperty('--corners2', `${num / 2}${unit}`);
    this.setProperty('--corners4', `${num / 4}${unit}`);

    const pad = num > 0 ? '20px' : '0';
    this.setProperty('--padding', pad);
  }

  getBorderRadius(): string {
    return this.getProperty('--corners');
  }

  /** Pôvodné helpers na farby (zachované ako aliasy) */
  setColor(property: string, color: string): void {
    this.setProperty(property, color);
  }

  getColor(property: string): string {
    return this.getProperty(property);
  }
}
