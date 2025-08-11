// src/app/models/aktualita.model.ts

export interface MediaFmt {
    url: string;
    width: number;
    height: number;
  }
  
  export interface MediaAttr {
    url: string;
    alternativeText?: string;
    formats?: Record<string, MediaFmt>;
  }
  
  export interface MediaData {
    id: number;
    attributes: MediaAttr;
  }
  
  export type SingleMedia = { data?: MediaData | null } | MediaAttr;
  export type MultiMedia = { data: MediaData[] } | MediaAttr[];
  
  export interface VideoUrl {
    label?: string;
    url: string;
  }
  
  export interface VideoGallery {
    videos: VideoUrl[];
  }
  
  export interface Aktualita {
    id: number;
    title: string;
    slug: string;
    summary: string;
    content: string;
    publishedAt: string;
    status: 'draft' | 'published' | 'archived';
  
    // Hlavný obrázok
    featuredImage?: SingleMedia;
    // Fotogaléria pod hlavným obrázkom
    gallery?: MultiMedia;
    // (Voliteľne) komponenta, ak máte video galériu
    videoGallery?: VideoGallery;
  
    author?: {
      id: number;
      username: string;
    } | null;
  
    categories?: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
  
    tags?: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
  
    seo?: {
      metaTitle?: string;
      metaDescription?: string;
    } | null;
  }
  