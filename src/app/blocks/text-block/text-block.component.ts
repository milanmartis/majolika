import {
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { LinkifyPipe } from 'app/pipes/linkify.pipe';
import { BlocksHtmlPipe } from 'app/pipes/blocks-html.pipe';
import { NbspSmallWordsPipe } from 'app/pipes/nbsp-small-words.pipe';

type Align = 'left' | 'center' | 'right';
type Cols = 'one' | 'two' | 'three';

@Component({
  selector: 'app-text-block',
  standalone: true,
  imports: [CommonModule, LinkifyPipe, BlocksHtmlPipe, NbspSmallWordsPipe],
  encapsulation: ViewEncapsulation.None, // aby CSS platilo aj pre [innerHTML] obsah
  styleUrls: ['text-block.component.css'],
  template: `
    <div
      #container
      class="text-block article-content"
      [ngClass]="{
        'align-left':   !block.alignment || block.alignment === 'left',
        'align-center': block.alignment === 'center',
        'align-right':  block.alignment === 'right',
        'is-html': !!block.richBlocks?.length,
        'is-plain': !block.richBlocks?.length,
        'cols-1': !block.columns || block.columns === 'one',
        'cols-2': block.columns === 'two',
        'cols-3': block.columns === 'three'
      }"
      (click)="onContainerClick($event)"
      [innerHTML]="block.richBlocks?.length
        ? (block.richBlocks | blocksHtml | linkify)
        : ((block.richText ?? '') | nbspSmallWords | linkify)
      "
    ></div>
  `,
})
export class TextBlockComponent implements AfterViewInit, OnChanges {
  @Input() block!: {
    richText?: string;
    richBlocks?: any[];
    columns?: Cols;               // 'one' | 'two' | 'three'
    alignment?: Align;            // 'left' | 'center' | 'right'
  };

  @ViewChild('container', { static: false }) container?: ElementRef<HTMLElement>;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    this.postProcessSoon();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['block']) this.postProcessSoon();
  }

  private postProcessSoon(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // počkaj, kým Angular vloží HTML, potom uprav DOM
    setTimeout(() => this.postProcess(), 0);
  }

  private postProcess(): void {
    const root = this.container?.nativeElement;
    if (!root) return;

    // Obrázky responsívne
    root.querySelectorAll('img').forEach((img) => {
      const el = img as HTMLImageElement;
      el.style.maxWidth = '100%';
      el.style.height = 'auto';
      el.style.display = 'block';
    });

    // Skry názvy súborov vo figcaption
    const fileLike = /\.[a-z0-9]{2,5}$/i;
    root.querySelectorAll('figure > figcaption').forEach((cap) => {
      const text = (cap.textContent || '').trim();
      if (fileLike.test(text)) (cap as HTMLElement).style.display = 'none';
    });

    // Zhoď leading/trailing <br> priamo v kontajneri
    while (root.firstChild && root.firstChild.nodeName === 'BR') {
      root.removeChild(root.firstChild);
    }
    while (root.lastChild && root.lastChild.nodeName === 'BR') {
      root.removeChild(root.lastChild);
    }
  }

  // Ak má rodič "klik na kartu", nech linky normálne fungujú
  onContainerClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest && target.closest('a')) {
      e.stopPropagation();
    }
  }
}
