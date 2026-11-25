import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUp,
  Check,
  Download,
  Menu,
  MessageCircle,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SlideRenderer } from '../components/canvas/SlideRenderer';
import { ResponsiveWebSection } from '../components/public/ResponsiveWebSection';
import { MediaLightboxModal } from '../components/public/MediaLightboxModal';
import {
  DEFAULT_PACKAGES,
  DEFAULT_PAGES,
  DEFAULT_PORTFOLIO_CONFIG,
  DEFAULT_SERVICES,
  DEFAULT_STUDIO_LOGO,
  DEFAULT_TESTIMONIALS,
} from '../data/defaultPortfolio';
import { subscribePublishedPortfolio, type PortfolioBundle } from '../services/portfolioService';
import type { GalleryMediaItem, PortfolioPage } from '../types/portfolio';
import { resolveAssetUrl } from '../utils/assetUrl';
import { exportSlidesToPdf } from '../utils/exportPdf';

function cleanSectionLabel(title: string): string {
  return title.replace(/^\d+\.\s*/, '').trim();
}

export const PublicPortfolioPage: React.FC = () => {
  const [bundle, setBundle] = useState<PortfolioBundle>({
    config: DEFAULT_PORTFOLIO_CONFIG,
    pages: DEFAULT_PAGES,
    services: DEFAULT_SERVICES,
    packages: DEFAULT_PACKAGES,
    testimonials: DEFAULT_TESTIMONIALS,
    isFromFirestore: false,
  });
  const [activeSlug, setActiveSlug] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<GalleryMediaItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');

  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribePublishedPortfolio(
      (data) => {
        setBundle(data);
      },
      (err) => {
        console.error('Error loading published portfolio:', err);
      }
    );
    return () => unsub();
  }, []);

  const visiblePages = useMemo(
    () => bundle.pages.filter((p) => p.visible).sort((a, b) => a.order - b.order),
    [bundle.pages]
  );

  // Key navigation links for the sticky header bar (up to 6 primary anchors)
  const navLinks = useMemo(() => {
    if (visiblePages.length <= 6) {
      return visiblePages.map((p) => ({ slug: p.slug, label: cleanSectionLabel(p.title) }));
    }
    const picks: Array<{ slug: string; label: string }> = [];
    const wantTypes: Array<{ match: (p: PortfolioPage) => boolean; fallbackLabel?: string }> = [
      { match: (p) => p.order === 1 || p.templateType === 'cover', fallbackLabel: 'Inicio' },
      { match: (p) => p.templateType === 'about' || p.slug.includes('sobre-mi') },
      { match: (p) => p.templateType === 'services' || p.slug === 'servicios' },
      { match: (p) => p.templateType.startsWith('packages_') || p.slug.includes('paquetes'), fallbackLabel: 'Paquetes' },
      { match: (p) => p.templateType === 'logofolio' || p.templateType === 'graphic_design', fallbackLabel: 'Portafolio' },
      { match: (p) => p.templateType === 'contact' || p.slug.includes('contacto'), fallbackLabel: 'Contacto' },
    ];
    for (const item of wantTypes) {
      const found = visiblePages.find((p) => item.match(p) && !picks.some((k) => k.slug === p.slug));
      if (found) {
        picks.push({
          slug: found.slug,
          label: item.fallbackLabel || cleanSectionLabel(found.title),
        });
      }
    }
    return picks;
  }, [visiblePages]);

  const scrollToSlug = useCallback((slug: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(`sec-${slug}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleScrollToNextFrom = useCallback(
    (index: number) => {
      const next = visiblePages[index + 1];
      if (next) scrollToSlug(next.slug);
    },
    [scrollToSlug, visiblePages]
  );

  const handleScrollToContact = useCallback(() => {
    const contactPage =
      visiblePages.find((p) => p.templateType === 'contact' || p.slug.includes('contacto')) ||
      visiblePages[visiblePages.length - 1];
    if (contactPage) scrollToSlug(contactPage.slug);
  }, [scrollToSlug, visiblePages]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 480);

      // Determine active section in viewport
      const scrollPos = window.scrollY + 120;
      let current = visiblePages[0]?.slug || '';
      for (const pg of visiblePages) {
        const node = document.getElementById(`sec-${pg.slug}`);
        if (node && node.offsetTop <= scrollPos) {
          current = pg.slug;
        }
      }
      setActiveSlug(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visiblePages]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxItem) setLightboxItem(null);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxItem, mobileMenuOpen]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleExportPdf = async () => {
    if (exportingPdf || !pdfContainerRef.current) return;
    setExportingPdf(true);
    setPdfProgress('Preparando...');
    try {
      await new Promise((r) => setTimeout(r, 150));
      await exportSlidesToPdf(
        () => Array.from(pdfContainerRef.current?.querySelectorAll('[data-pdf-slide]') || []) as HTMLElement[],
        bundle.config.studioName || 'portafolio',
        (cur, tot) => setPdfProgress(`${cur}/${tot}`)
      );
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExportingPdf(false);
      setPdfProgress('');
    }
  };

  const identity = bundle.config.visualIdentity;
  const contact = bundle.config.contact;
  const waDigits = (contact.whatsappNumber || '').replace(/\D/g, '');
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        contact.whatsappDefaultMessage || 'Hola, quiero cotizar un proyecto.'
      )}`
    : undefined;

  if (visiblePages.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F6FC] text-purple-950 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold">Portafolio sin secciones visibles</h1>
          <p className="text-sm text-purple-900/70">
            Actualmente no hay secciones publicadas visibles para mostrar.
          </p>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#6D28D9] rounded-full"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Ir al Panel Administrativo</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-[#F8F6FC] text-[#2E1065] antialiased selection:bg-purple-600 selection:text-white"
      style={{ fontFamily: identity.bodyFont || "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Sticky Website Navbar */}
      <header className="sticky top-0 z-40 h-16 border-b border-purple-950/10 bg-white/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
          >
            <img
              src={resolveAssetUrl(identity.logoUrl) || DEFAULT_STUDIO_LOGO}
              alt={bundle.config.studioName}
              referrerPolicy="no-referrer"
              className="h-9 w-auto max-w-[140px] object-contain shrink-0"
            />
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-tight text-[#2E1065] truncate">
                {bundle.config.studioName}
              </span>
              {contact.specialty && (
                <span className="hidden sm:block text-[11px] text-purple-900/60 truncate">
                  {contact.specialty}
                </span>
              )}
            </div>
          </button>

          {/* Desktop Anchor Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((nav) => {
              const isActive = activeSlug === nav.slug;
              return (
                <button
                  key={nav.slug}
                  type="button"
                  onClick={() => scrollToSlug(nav.slug)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-100 text-purple-900'
                      : 'text-purple-950/70 hover:text-purple-950 hover:bg-purple-50'
                  }`}
                >
                  {nav.label}
                </button>
              );
            })}
          </nav>

          {/* Right Web Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {bundle.config.allowPublicPdfExport !== false && (
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-50 border border-purple-200 rounded-full transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {exportingPdf ? `PDF ${pdfProgress}` : 'Portafolio PDF'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartir portafolio"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-50 border border-purple-200 rounded-full transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">{copiedLink ? 'Copiado' : 'Compartir'}</span>
            </button>

            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-full shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
                style={{ backgroundColor: identity.accentColor || '#8B3DFF' }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Cotizar</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleScrollToContact}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-full shadow-sm hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: identity.accentColor || '#8B3DFF' }}
              >
                <span>Contacto</span>
              </button>
            )}

            <Link
              to="/admin"
              title="Ingresar al Panel Administrativo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#2E1065] bg-purple-100 hover:bg-purple-200 border border-purple-300/70 rounded-full transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
              <span>ADMIN</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Menú de secciones"
              className="lg:hidden p-2 rounded-lg text-purple-950 hover:bg-purple-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Quick Section Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-purple-100 bg-white/98 backdrop-blur-md px-4 py-3 shadow-xl max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visiblePages.map((pg, idx) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => scrollToSlug(pg.slug)}
                  className={`px-3 py-2 text-left text-xs font-semibold rounded-lg border transition-colors cursor-pointer truncate ${
                    activeSlug === pg.slug
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-purple-50/60 text-purple-950 border-purple-100 hover:bg-purple-100'
                  }`}
                >
                  <span className="font-mono opacity-70 mr-1.5">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {cleanSectionLabel(pg.title)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Continuous Vertical Web Page */}
      <main className="flex-1 w-full">
        {visiblePages.map((pg, idx) => {
          const sectionBg = pg.backgroundGradient || pg.backgroundColor || identity.backgroundColor || '#F8F6FC';
          return (
            <section
              key={pg.id}
              id={`sec-${pg.slug}`}
              className="w-full scroll-mt-16 relative"
              style={{
                backgroundColor: pg.backgroundColor || identity.backgroundColor || '#F8F6FC',
                background: sectionBg,
              }}
            >
              {/* Desktop / Tablet Landscape: Seamless Full-Width Editable Web Bands */}
              <div className="hidden md:block w-full max-w-[1440px] mx-auto">
                <SlideRenderer
                  page={pg}
                  identity={identity}
                  contact={contact}
                  services={bundle.services}
                  packages={bundle.packages}
                  testimonials={bundle.testimonials}
                  onNextPage={() => handleScrollToNextFrom(idx)}
                  onGotoContact={handleScrollToContact}
                  onOpenLightbox={(item) => setLightboxItem(item)}
                />
              </div>

              {/* Mobile: Native Vertical Stacked Responsive Web Layout */}
              <div className="md:hidden w-full">
                <ResponsiveWebSection
                  page={pg}
                  identity={identity}
                  contact={contact}
                  services={bundle.services}
                  packages={bundle.packages}
                  testimonials={bundle.testimonials}
                  onScrollToNext={() => handleScrollToNextFrom(idx)}
                  onScrollToContact={handleScrollToContact}
                  onOpenLightbox={(item) => setLightboxItem(item)}
                />
              </div>
            </section>
          );
        })}
      </main>

      {/* Clean Editorial Website Footer */}
      <footer className="bg-[#2E1065] text-purple-100 border-t border-white/10 py-10 px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow">
              <img
                src={resolveAssetUrl(identity.logoUrl) || DEFAULT_STUDIO_LOGO}
                alt={bundle.config.studioName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-white">{bundle.config.studioName}</h2>
              <p className="text-xs text-purple-200/80">
                {[contact.professionalName, contact.specialty, contact.location].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {navLinks.map((nav) => (
              <button
                key={nav.slug}
                type="button"
                onClick={() => scrollToSlug(nav.slug)}
                className="text-purple-200/80 hover:text-white transition-colors cursor-pointer"
              >
                {nav.label}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Back to Top Floating Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          className="fixed bottom-5 right-5 z-30 w-10 h-10 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
          style={{ backgroundColor: identity.accentColor || '#8B3DFF' }}
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* Studio Lightbox Modal for Images & Videos */}
      {lightboxItem && (
        <MediaLightboxModal
          item={lightboxItem}
          items={visiblePages.flatMap((pg) => {
            const list: GalleryMediaItem[] = [];
            for (const el of pg.elements || []) {
              if (el.hidden) continue;
              if (el.type === 'image' && el.mediaUrl && !el.linkUrl && el.enablePopup !== false) {
                list.push({
                  id: el.id,
                  url: resolveAssetUrl(el.mediaUrl),
                  title: el.content || el.name,
                  category: pg.title,
                  mediaType: 'image',
                });
              } else if (el.type === 'gallery') {
                for (const gi of el.galleryItems || []) {
                  if (gi.enablePopup !== false && gi.url && gi.mediaType !== 'video' && !gi.videoUrl) {
                    list.push({ ...gi, url: resolveAssetUrl(gi.url) });
                  }
                }
              }
            }
            return list;
          })}
          identity={identity}
          onClose={() => setLightboxItem(null)}
          onSelectItem={(next) => setLightboxItem(next)}
        />
      )}

      {/* Off-screen 1280x720 PDF Export Container (Always Mounted While Exporting) */}
      {exportingPdf && (
        <div
          ref={pdfContainerRef}
          aria-hidden="true"
          className="fixed -left-[99999px] top-0 pointer-events-none"
        >
          {visiblePages.map((pg) => (
            <div key={pg.id} data-pdf-slide style={{ width: '1280px', height: '720px' }}>
              <SlideRenderer
                page={pg}
                identity={identity}
                contact={contact}
                services={bundle.services}
                packages={bundle.packages}
                testimonials={bundle.testimonials}
                fixedWidth={1280}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
