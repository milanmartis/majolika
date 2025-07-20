import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TextBlock } from 'app/models/blocks.model';

@Component({
  selector: 'app-text-block',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="color:#000;padding-bottom:10px; float:left; white-space: pre-line;" class="prose text-left" [innerHTML]="block.richText"></div>`,
  styleUrls: ['text-block.component.css'],
})
export class TextBlockComponent {
  @Input() block!: TextBlock;
}