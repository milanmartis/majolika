import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

type TextNode = {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type LinkNode = { type: 'link'; url: string; children: Node[] };
type ParagraphNode = { type: 'paragraph'; children: Node[] };
type HeadingNode = { type: 'heading'; level?: number; children: Node[] };
type ListItemNode = { type: 'list-item'; children: Node[] };
type ListNode = { type: 'list'; format?: 'unordered' | 'ordered'; children: ListItemNode[] };
type ImageNode = {
  type: 'image';
  image?: { url?: string; alternativeText?: string; width?: number; height?: number };
};

type Node =
  | TextNode
  | LinkNode
  | ParagraphNode
  | HeadingNode
  | ListNode
  | ListItemNode
  | ImageNode
  | { type: string; [k: string]: any };

@Pipe({ name: 'blocksHtml', standalone: true })
export class BlocksHtmlPipe implements PipeTransform {
  constructor(private s: DomSanitizer) {}

  transform(content: Node[] | undefined | null): SafeHtml {
    const html = (content ?? []).map((n: Node) => this.renderNode(n)).join('');
    return this.s.bypassSecurityTrustHtml(html);
  }

  private esc(str: string): string {
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  private renderInline(node: TextNode | LinkNode): string {
    if (node.type === 'text') {
      let t = this.esc(node.text ?? '');
      if (node.code) t = `<code>${t}</code>`;
      if (node.bold) t = `<strong>${t}</strong>`;
      if (node.italic) t = `<em>${t}</em>`;
      if (node.underline) t = `<u>${t}</u>`;
      if (node.strikethrough) t = `<s>${t}</s>`;
      return t;
    }
    if (node.type === 'link') {
      const inner = (node.children ?? [])
        .map((c: Node) => this.renderInline(c as TextNode | LinkNode))
        .join('');
      const url = this.esc(node.url ?? '#');
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    }
    return '';
  }

  private renderNode(node: Node): string {
    switch (node.type) {
      case 'paragraph': {
        const inner = (node.children ?? [])
          .map((c: Node) => this.renderInline(c as TextNode | LinkNode))
          .join('');
        return `<p>${inner}</p>`;
      }
      case 'heading': {
        const lvl = Math.min(Math.max(((node as HeadingNode).level ?? 2), 1), 6);
        const inner = ((node as HeadingNode).children ?? [])
          .map((c: Node) => this.renderInline(c as TextNode | LinkNode))
          .join('');
        return `<h${lvl}>${inner}</h${lvl}>`;
      }
      case 'list': {
        const list = node as ListNode;
        const tag = (list.format ?? 'unordered') === 'ordered' ? 'ol' : 'ul';
        const items = (list.children ?? [])
          .map((li: ListItemNode) => {
            const liInner = (li.children ?? [])
              .map((c: Node) => this.renderNode(c))
              .join('');
            return `<li>${liInner}</li>`;
          })
          .join('');
        return `<${tag}>${items}</${tag}>`;
      }
      case 'list-item': {
        const li = node as ListItemNode;
        return (li.children ?? []).map((c: Node) => this.renderNode(c)).join('');
      }
      case 'image': {
        const imgNode = node as ImageNode;
        const img = imgNode.image ?? {};
        const url = img.url ?? '';
        const alt = this.esc(img.alternativeText ?? '');
        if (!url) return '';
        return `<figure><img src="${url}" alt="${alt}"/>${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`;
      }
      case 'link':
      case 'text':
        return this.renderInline(node as TextNode | LinkNode);
      default:
        // neznámy blok – ignoruj alebo zaloguj
        return '';
    }
  }
}
