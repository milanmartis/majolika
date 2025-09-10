// cookie-consent.model.ts
export type ConsentCategory = 'necessary' | 'analytics';

export interface CookieConsent {
  version: number;                // zvýš ak zmeníš zásady
  necessary: true;                // vždy true (nevypínateľné)
  analytics: boolean;             // používateľ prepína
  updatedAt: string;              // ISO dátum
  locale: 'sk' | 'en' | 'de';     // uložíme aktuálny jazyk
}