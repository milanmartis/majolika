// src/app/shared/share-buttons/share-buttons.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-share-buttons',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './share-buttons.component.html',
  styleUrls: ['./share-buttons.component.css'],
})
export class ShareButtonsComponent implements OnInit {
  /** SEO / share data z parenta (produkt / kategória / článok) */
  @Input() title: string = '';          // napr. product.name
  @Input() url: string = '';            // napr. articleUrl / canonical URL
  @Input() description: string = '';    // SEO description (už očistený text)
  @Input() image: string = '';          // primary image / aktuálny obrázok
  @Input() ogType: 'product' | 'website' | 'article' = 'product';

  shareLinks: { platform: string; url: string }[] = [];

  constructor(
    private meta: Meta,
    private titleSvc: Title,
  ) {}

  ngOnInit(): void {
    const finalUrl =
      this.url ||
      (typeof window !== 'undefined' ? window.location.href : '');

    const encodedUrl = encodeURIComponent(finalUrl);
    const encodedTitle = encodeURIComponent(this.title || '');

    this.shareLinks = [
      {
        platform: 'facebook',
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      },
      {
        platform: 'whatsapp',
        url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      },
    ];

    // 🔽 tuto spravíme „mini setSeo“ podľa inputov
    this.applySeoFromInputs(finalUrl);
  }

  /** Nastaví <title>, description, OG a Twitter meta podľa @Input() */
  private applySeoFromInputs(finalUrl: string): void {
    const pageTitle =
      this.title
        ? `${this.title} | Majolika Modra – ručne maľovaná keramika`
        : 'Majolika Modra – ručne maľovaná keramika';

    const desc = (this.description || '').toString().trim();
    const cleanDesc = desc
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);

    // title
    this.titleSvc.setTitle(pageTitle);

    // description
    if (cleanDesc) {
      this.meta.updateTag({ name: 'description', content: cleanDesc });
    }

    // absolútna URL obrázka
    let finalImage = this.image;
    if (finalImage && typeof window !== 'undefined' && !/^https?:\/\//i.test(finalImage)) {
      const origin = window.location.origin.replace(/\/$/, '');
      const sep = finalImage.startsWith('/') ? '' : '/';
      finalImage = `${origin}${sep}${finalImage}`;
    }

    // OG
    this.meta.updateTag({ property: 'og:type', content: this.ogType });
    if (this.title) {
      this.meta.updateTag({ property: 'og:title', content: this.title });
    }
    if (cleanDesc) {
      this.meta.updateTag({ property: 'og:description', content: cleanDesc });
    }
    this.meta.updateTag({ property: 'og:url', content: finalUrl });
    if (finalImage) {
      this.meta.updateTag({ property: 'og:image', content: finalImage });
    }

    // Twitter
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    if (this.title) {
      this.meta.updateTag({ name: 'twitter:title', content: this.title });
    }
    if (cleanDesc) {
      this.meta.updateTag({ name: 'twitter:description', content: cleanDesc });
    }
    if (finalImage) {
      this.meta.updateTag({ name: 'twitter:image', content: finalImage });
    }
  }

  shareNative() {
    const shareData: any = {
      title: this.title,
      text: this.title,
      url: this.url || (typeof window !== 'undefined' ? window.location.href : ''),
    };

    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any)
        .share(shareData)
        .catch((err: any) => {
          console.error('Zdieľanie zlyhalo:', err);
        });
    } else {
      alert('Zdieľanie nie je podporované v tomto prehliadači.');
    }
  }
}
