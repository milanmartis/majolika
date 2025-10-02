import { Pipe, PipeTransform, Inject, PLATFORM_ID, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';

@Pipe({ name: 'linkify', standalone: true })
export class LinkifyPipe implements PipeTransform {
  constructor(
    private san: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  transform(value: unknown): SafeHtml {
    if (!isPlatformBrowser(this.platformId)) {
      return typeof value === 'string' ? value : (value as any);
    }

    let input = '';
    if (typeof value === 'string') input = value;
    else input = this.san.sanitize(SecurityContext.HTML, value as any) ?? '';

    const container = document.createElement('div');
    container.innerHTML = input;

    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'a' || tag === 'script' || tag === 'style') return;
        Array.from(el.childNodes).forEach(walk);
        return;
      }
      if (node.nodeType !== Node.TEXT_NODE) return;

      const text = node.nodeValue ?? '';
      if (!text.trim()) return;

      const frag = this.textToLinkedFragment(text);
      if (frag) node.parentNode?.replaceChild(frag, node);
    };

    Array.from(container.childNodes).forEach(walk);
    return this.san.bypassSecurityTrustHtml(container.innerHTML);
  }

  private textToLinkedFragment(text: string): DocumentFragment | null {
    const email = '(?<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[A-Za-z]{2,})';
    const protoUrl = '(?<protoUrl>https?:\\/\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+)';
    const wwwUrl   = '(?<wwwUrl>www\\.[^\\s<]+\\.[a-zA-Z]{2,}[^\\s<]*)';
    const bareDom  = '(?<bareUrl>(?:[\\w-]+\\.)+[a-zA-Z]{2,}(?:\\/[^\\s<]*)?)';

    // FIX: zachytí 3×3 čísla za +421 9xx / 09xx (napr. +421 911 980 105)
    const phone =
      '(?<phone>(?<!\\d)(?:\\+?421[\\s.-]?\\d{3}(?:[\\s.-]?\\d{3}){2}|0\\d{2,3}(?:[\\s.-]?\\d{3}){2})(?!\\d))';

    const any = new RegExp(`${email}|${protoUrl}|${wwwUrl}|${bareDom}|${phone}`, 'g');

    let lastIndex = 0;
    const frag = document.createDocumentFragment();
    let changed = false;

    for (let m; (m = any.exec(text)); ) {
      const idx = m.index;
      const match = m[0];

      if (idx > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
      }

      let a: HTMLAnchorElement | null = null;
      const g = m.groups as Record<string, string> | undefined;

      if (g?.['email']) {
        a = this.mkLink(`mailto:${g['email']}`, g['email']);
      } else if (g?.['protoUrl']) {
        const core = this.stripTrailingPunct(g['protoUrl']);
        a = this.mkLink(core, core);
      } else if (g?.['wwwUrl']) {
        const core = this.stripTrailingPunct(g['wwwUrl']);
        a = this.mkLink('https://' + core, core);
      } else if (g?.['bareUrl']) {
        const core = this.stripTrailingPunct(g['bareUrl']);
        a = this.mkLink('https://' + core, core);
      } else if (g?.['phone']) {
        const normalized = g['phone'].replace(/[^\d+]/g, '');
        const digitsLen = normalized.replace(/\D/g, '').length;
        if (digitsLen >= 9) a = this.mkLink(`tel:${normalized}`, g['phone']);
      }

      frag.appendChild(a ?? document.createTextNode(match));
      if (a) changed = true;

      lastIndex = idx + match.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    return changed ? frag : null;
  }

  private mkLink(href: string, text: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    if (!/^mailto:|^tel:/.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  private stripTrailingPunct(s: string): string {
    return s.replace(/[)\]\}.,;:!?]+$/, '');
  }
}
