// Core type definitions for the Agentic Chrome Extension
// These will be expanded in later tasks

export interface WebsiteContext {
  domain: string;
  category: WebsiteCategory;
  pageType: PageType;
  extractedData: Record<string, unknown>;
}

export enum WebsiteCategory {
  SOCIAL_MEDIA = 'social_media',
  ECOMMERCE = 'ecommerce',
  PROFESSIONAL = 'professional',
  NEWS_CONTENT = 'news_content',
  PRODUCTIVITY = 'productivity',
  CUSTOM = 'custom'
}

export enum PageType {
  HOME = 'home',
  PRODUCT = 'product',
  ARTICLE = 'article',
  PROFILE = 'profile',
  FORM = 'form',
  OTHER = 'other'
}

export interface PageContent {
  url: string;
  title: string;
  headings: string[];
  textContent: string;
  forms: FormElement[];
  links: LinkElement[];
  metadata: Record<string, string>;
}

export interface FormElement {
  id?: string;
  name?: string;
  type: string;
  placeholder?: string;
  required: boolean;
}

export interface LinkElement {
  href: string;
  text: string;
  title?: string;
}