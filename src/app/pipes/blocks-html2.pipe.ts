// blocks-html.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Vytiahni svoju existujúcu logiku generovania HTML do tejto funkcie. */
export function renderBlocksToHtml(content: Node[] | null | undefined): string {
  // TODO: sem presuň tú istú logiku, ktorú dnes používaš vo svojom BlocksHtmlPipe,
  // ale nech vracia obyčajný string (ešte NESANITOVANÝ).
  // Príklad – iba ilustračný:
  if (!content || !Array.isArray(content) || content.length === 0) return '';
  return content.map(n => (n as any)?.outerHTML ?? '').join('');
}

/** Pôvodný pipe: vracia SafeHtml (bez zmeny chovania) */
@Pipe({ name: 'blocksHtml', standalone: true })
export class BlocksHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(content: Node[] | null | undefined): SafeHtml {
    const html = renderBlocksToHtml(content);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

/** Nový pipe: vracia STRING – na ten vieš reťaziť ďalšie stringové pipe-y */
@Pipe({ name: 'blocksHtmlStr', standalone: true })
export class BlocksHtmlStrPipe implements PipeTransform {
  transform(content: Node[] | null | undefined): string {
    return renderBlocksToHtml(content);
  }
}