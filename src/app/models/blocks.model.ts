// Modely blokov
export type ContentBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | LinkBlock
  | VideoBlock;

export interface HeadingBlock {
  __component: 'blocks.heading-block';
  id: number;
  text: string;
}

export interface TextBlock {
  __component: 'blocks.text-block';
  id: number;
  richText: string;
}

export interface ImageBlock {
  __component: 'blocks.image-block';
  id: number;
  alignment: 'left' | 'center' | 'right';
  thumbnailUrl: string;
  mediumUrl: string;
  largeUrl: string;
  /** Nepovinný popis obrázka */
  caption?: string;
}

export interface LinkBlock {
  __component: 'blocks.link-block';
  id: number;
  text: string;
  url: string;
  newTab: boolean;
}

export interface VideoBlock {
  __component: 'blocks.video-block';
  id: number;
  // videoUrl vracia Strapi (S3) v attributes.url
  videoUrl?: string;
  // absolútna URL po spracovaní Service
  url: string;
  caption?: string;
}