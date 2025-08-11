// src/app/pipes/linkify.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'linkify' })
export class LinkifyPipe implements PipeTransform {
  // URL ↔ http://… alebo https://…
  private urlRegex = /(\bhttps?:\/\/[^\s<]+)/g;
  // Email ↔ niečo@niečo.xy
  private emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})/g;

  constructor(private sanitizer: DomSanitizer) {}

  transform(html: string): SafeHtml {
    if (!html) return html;

    // 1) “mailto:” pre emaily
    const withEmails = html.replace(
      this.emailRegex,
      `<a href="mailto:$1">$1</a>`
    );

    // 2) obalenie URL
    const withLinks = withEmails.replace(
      this.urlRegex,
      `<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>`
    );

    // 3) označíme ako bezpečný HTML
    return this.sanitizer.bypassSecurityTrustHtml(withLinks);
  }
}