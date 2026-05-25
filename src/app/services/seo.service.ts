// src/app/services/seo.service.ts
import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title, Meta } from '@angular/platform-browser';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface StrapiMedia {
  data?: {
    attributes?: {
      url?: string;
    };
  };
}

interface StrapiSeo {
  metaTitle?: string;
  metaDescription?: string;
  shareImage?: StrapiMedia;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  /** API_URL = https://majolika-cms.appdesign.sk/api (už obsahuje /api) */
  private apiBase: string;

  constructor(
    private http: HttpClient,
    private title: Title,
    private meta: Meta,
    @Inject('API_URL') apiUrl: string,
    @Inject('FRONTEND_URL') private frontendUrl: string
  ) {
    // ✅ už NEPRIDÁVAME ďalšie /api
    this.apiBase = apiUrl.replace(/\/+$/, ''); // -> https://majolika-cms.appdesign.sk/api
  }

  /** Stránky v Strapi – CT "page" => endpoint /pages */
  setPageSeo(slug: string) {
    this.http
      .get<any>(`${this.apiBase}/produkt`, {
        params: {
          'filters[slug][$eq]': slug,
          'populate': 'seo,seo.shareImage',
          'locale': 'sk',
        }
      })
      .pipe(
        map(res => res.data?.[0]?.attributes?.seo as StrapiSeo | undefined),
        // 🔇 potlačí chyby (404, 500...) – nepadne subscribe a nič nepíše do konzoly
        catchError(_err => of(undefined))
      )
      .subscribe(seo => {
        if (!seo) return;
        this.applySeo(seo);
      });
  }

  applySeo(seo: StrapiSeo | null | undefined, fallbackTitle?: string) {
    if (!seo && !fallbackTitle) return;

    const metaTitle =
      seo?.metaTitle ||
      fallbackTitle ||
      'Slovenská ľudová majolika Modra';

    const metaDescription =
      seo?.metaDescription ||
      'Slovenská ľudová majolika Modra – ručne maľovaná keramika.';

    this.title.setTitle(metaTitle);
    this.meta.updateTag({ name: 'description', content: metaDescription });

    this.meta.updateTag({ property: 'og:title', content: metaTitle });
    this.meta.updateTag({ property: 'og:description', content: metaDescription });

    const imageUrl =
      seo?.shareImage?.data?.attributes?.url
        ? this.toAbsoluteUrl(seo.shareImage.data.attributes.url)
        : undefined;

    if (imageUrl) {
      this.meta.updateTag({ property: 'og:image', content: imageUrl });
      this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
    }

    this.meta.updateTag({ property: 'og:type', content: 'website' });

    // pozor na SSR – toto používaj len v browseri, ale ty máš klasický SPA, takže OK
    const currentPath =
      typeof window !== 'undefined' ? (window.location.pathname || '/') : '/';

    this.meta.updateTag({
      property: 'og:url',
      content: this.frontendUrl.replace(/\/$/, '') + currentPath,
    });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
  }

  private toAbsoluteUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    // apiBase = https://majolika-cms.appdesign.sk/api -> backend doména
    const backendBase = this.apiBase.replace(/\/api$/, '');
    const sep = url.startsWith('/') ? '' : '/';
    return `${backendBase}${sep}${url}`;
  }
}
