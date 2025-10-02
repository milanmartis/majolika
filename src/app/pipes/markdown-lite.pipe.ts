import { Pipe, PipeTransform, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Minimal Markdown → HTML:
 * - [![alt](img "title")](href)
 * - ![alt](img "title")
 * - [text](href)
 * - voľné URL obrázka na samostatnom slove -> <img>
 * - ostatné URL necháme na linkify
 *
 * Výstup je string (nie SafeHtml), aby mohol ísť ďalej cez iné pipy (napr. linkify).
 */
@Pipe({ name: 'markdownLite', standalone: true })
export class MarkdownLitePipe implements PipeTransform {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  transform(value: unknown): string {
    // SSR: žiaden DOM, len string
    let input = typeof value === 'string' ? value : String(value ?? '');
    if (!isPlatformBrowser(this.platformId)) return input;

    // 0) Obrázok zabalený v odkaze: [![alt](IMG "title")](HREF)
    // - vezmeme čokoľvek po najbližšiu ) (bežné URL bez zátvoriek)
    // - tolerujeme medzery okolo
    const linkedImgMd =
      /\[\s*!\[([^\]]*)\]\(\s*([^)"]+?)(?:\s+"([^"]+)")?\s*\)\s*\]\(\s*([^)]+?)\s*\)/g;
    input = input.replace(linkedImgMd, (_, alt: string, img: string, title?: string, href?: string) => {
      const safeAlt = (alt ?? '').replace(/"/g, '&quot;');
      const safeTitle = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
      const safeHref = href ?? '#';
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"><img src="${img}" alt="${safeAlt}"${safeTitle} /></a>`;
    });

    // 1) Samostatný obrázok: ![alt](IMG "title")
    const imgMd = /!\[([^\]]*)\]\(\s*([^)"]+?)(?:\s+"([^"]+)")?\s*\)/g;
    input = input.replace(imgMd, (_, alt: string, url: string, title?: string) => {
      const safeAlt = (alt ?? '').replace(/"/g, '&quot;');
      const safeTitle = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
      return `<img src="${url}" alt="${safeAlt}"${safeTitle} />`;
    });

    // 2) Klasické odkazy: [text](HREF)
    const linkMd = /\[([^\]]+)\]\(\s*([^)]+?)\s*\)/g;
    input = input.replace(linkMd, (_, text: string, url: string) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // 3) Voľné obrázkové URL na samostatnom „slove“ -> <img>, iné necháme na linkify
    const imgExt = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;
    input = input.replace(
      /(^|\s)(https?:\/\/[^\s<>"']+)(?=$|\s)/g,
      (m, lead: string, url: string) => imgExt.test(url)
        ? `${lead}<img src="${url}" alt="" />`
        : `${lead}${url}`
    );

    return input;
  }
}
