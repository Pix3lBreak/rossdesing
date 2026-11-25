export type ElementType =
  | 'heading'
  | 'text'
  | 'image'
  | 'video'
  | 'button'
  | 'card'
  | 'shape'
  | 'divider'
  | 'gallery'
  | 'services-grid'
  | 'packages-grid'
  | 'testimonials-grid'
  | 'contact-block'
  | 'stats-row';

export interface GalleryMediaItem {
  id: string;
  url: string;
  title: string;
  category: string;
  client?: string;
  year?: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  videoAction?: 'online' | 'download' | 'external';
  videoActionLabel?: string;
  enablePopup?: boolean;
}

export interface StatEntry {
  id: string;
  value: string;
  label: string;
}

export interface CanvasElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  lineHeight?: number;
  letterSpacing?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  opacity?: number;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  objectFit?: 'cover' | 'contain';
  objectPositionX?: number; // 0 to 100 (%)
  objectPositionY?: number; // 0 to 100 (%)
  imageZoom?: number; // 1 to 2.5
  textTransform?: 'none' | 'uppercase';
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  name: string;
  x: number; // Logical 1280px coordinate (0..1280)
  y: number; // Logical 720px coordinate (0..720)
  w: number; // Width in 1280px coordinate space
  h: number; // Height in 720px coordinate space
  zIndex: number;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
  // Content properties
  content?: string;
  secondaryContent?: string;
  mediaUrl?: string;
  posterUrl?: string;
  videoClickMode?: 'online' | 'download' | 'external';
  videoActionLabel?: string;
  enablePopup?: boolean;
  linkUrl?: string;
  linkAction?: 'url' | 'whatsapp' | 'email' | 'next-page' | 'goto-contact';
  // Dynamic binding properties
  packageCategory?: 'branding' | 'social' | 'video' | 'custom';
  galleryItems?: GalleryMediaItem[];
  statsItems?: StatEntry[];
  galleryColumns?: number;
  style: CanvasElementStyle;
}

export interface PortfolioPage {
  id: string;
  order: number;
  slug: string;
  title: string;
  subtitle?: string;
  templateType: string;
  visible: boolean;
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  accentColorOverride?: string;
  elements: CanvasElement[];
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VisualIdentity {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  gradientBackground?: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  logoUrl?: string;
  headingFont: string;
  bodyFont: string;
  baseFontScale: number; // 0.9 to 1.15
  buttonStyle: 'sharp' | 'soft' | 'pill';
  borderRadius: number; // px
  shadowStyle: 'none' | 'subtle' | 'elevated';
  spacingDensity: 'compact' | 'balanced' | 'airy';
  decorativeBackground: 'clean' | 'grid' | 'editorial-lines' | 'warm-glow';
}

export interface ContactConfig {
  studioName: string;
  professionalName: string;
  specialty: string;
  location: string;
  email: string;
  whatsappNumber: string;
  whatsappDefaultMessage: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
}

export interface PortfolioConfig {
  studioName: string;
  studioTagline?: string;
  seoDescription?: string;
  publicSlug?: string;
  allowPublicPdfExport?: boolean;
  visualIdentity: VisualIdentity;
  contact: ContactConfig;
  hasUnpublishedChanges?: boolean;
  lastPublishedVersionId?: string;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ServiceItem {
  id: string;
  number?: string;
  title: string;
  description: string;
  category?: string;
  deliverables?: string[];
  visible: boolean;
  order: number;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PackageItem {
  id: string;
  category: 'branding' | 'social' | 'video' | 'custom';
  name: string;
  description?: string;
  price?: string;
  currency: string;
  billingPeriod?: string;
  imageUrl?: string;
  features: string[];
  promoLabel?: string;
  isPopular: boolean;
  visible: boolean;
  order: number;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TestimonialItem {
  id: string;
  clientName: string;
  clientRole?: string;
  company?: string;
  quote: string;
  resultMetric?: string;
  avatarUrl?: string;
  visible: boolean;
  order: number;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MediaFolder {
  id: string;
  name: string;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  mediaType: 'image' | 'logo' | 'video';
  mimeType?: string;
  sizeBytes?: number;
  folderId?: string;
  category?: string;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PortfolioSnapshot {
  config: Omit<PortfolioConfig, 'createdAt' | 'updatedAt'>;
  pages: Array<Omit<PortfolioPage, 'createdAt' | 'updatedAt'>>;
  services: Array<Omit<ServiceItem, 'createdAt' | 'updatedAt'>>;
  packages: Array<Omit<PackageItem, 'createdAt' | 'updatedAt'>>;
  testimonials: Array<Omit<TestimonialItem, 'createdAt' | 'updatedAt'>>;
}

export interface PortfolioVersion {
  id: string;
  label: string;
  notes?: string;
  snapshot: PortfolioSnapshot;
  ownerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'admin';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AdminSection =
  | 'dashboard'
  | 'editor'
  | 'pages'
  | 'media'
  | 'services'
  | 'packages'
  | 'testimonials'
  | 'contact'
  | 'identity'
  | 'settings'
  | 'publish';
