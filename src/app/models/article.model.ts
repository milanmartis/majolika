// src/app/models/article.model.ts
import type { ContentBlock } from './blocks.model';

export interface Article {
  id: number;
  title: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  locale: string | null;
  content: ContentBlock[];
}