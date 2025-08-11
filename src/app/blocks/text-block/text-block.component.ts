import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TextBlock } from 'app/models/blocks.model';
import { LinkifyPipe } from 'app/pipes/linkify.pipe';

@Component({
  selector: 'app-text-block',
  standalone: true,
  imports: [CommonModule, LinkifyPipe],
  template: `
    <div
      class="prose text-block"
      [ngClass]="{
        'block-two-cols': block.columns === 'two',
        'block-one-col': !block.columns || block.columns === 'one',
        'align-left': !block.alignment || block.alignment === 'left',
        'align-center': block.alignment === 'center',
        'align-right': block.alignment === 'right'
      }"
      [innerHTML]="block.richText | linkify"
    ></div>
  `,
  styleUrls: ['text-block.component.css'],
})
export class TextBlockComponent {
  @Input() block!: TextBlock;
}