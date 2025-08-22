import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HeadingBlock } from 'app/models/blocks.model';

@Component({
  selector: 'app-heading-block',
  standalone: true,
  imports: [CommonModule],
  template: `<h2 style="margin-top:-10px;" class="text-2xl font-semibold">{{ block.text }}</h2>`,
})
export class HeadingBlockComponent {
  @Input() block!: HeadingBlock;
}