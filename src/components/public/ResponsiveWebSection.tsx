import React, { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Expand,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  Mail,
  MessageCircle,
  Play,
  Video as VideoIcon,
} from 'lucide-react';
import type {
  CanvasElement,
  ContactConfig,
  GalleryMediaItem,
  PackageItem,
  PortfolioPage,
  ServiceItem,
  TestimonialItem,
  VisualIdentity,
} from '../../types/portfolio';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { normalizeSafeUrl, parseVideoSource, resolveVideoClickTarget } from '../../utils/videoEmbed';

interface ResponsiveWebSectionProps {
  page: PortfolioPage;
  identity: VisualIdentity;
  contact: ContactConfig;
  services: ServiceItem[];
  packages: PackageItem[];
  testimonials: TestimonialItem[];
  onScrollToNext?: () => void;
  onScrollToContact?: () => void;
  onOpenLightbox?: (item: GalleryMediaItem) => void;
}

function buildWhatsappUrl(contact: ContactConfig, customMessage?: string): string {
  const digits = (contact.whatsappNumber || '').replace(/\D/g, '');
  const text = encodeURIComponent(
    customMessage || contact.whatsappDefaultMessage || 'Hola, me interesa cotizar un servicio.'
  );
  if (!digits) return '#';
  return `https://wa.me/${digits}?text=${text}`;
}

export const ResponsiveWebSection: React.FC<ResponsiveWebSectionProps> = ({
  page,
  identity,
  contact,
  services,
  packages,
  testimonials,
  onScrollToNext,
  onScrollToContact,
  onOpenLightbox,
}) => {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [galleryFilter, setGalleryFilter] = useState<string>('Todos');

  const bgColor = page.backgroundColor || identity.backgroundColor || '#F8F6FC';
  const bgGradient = page.backgroundGradient || '';
  const isDarkSlide =
    Boolean(bgGradient) ||
    bgColor.toLowerCase().startsWith('#4') ||
    bgColor.toLowerCase().startsWith('#5') ||
    bgColor.toLowerCase().startsWith('#6') ||
    bgColor.toLowerCase().startsWith('#1') ||
    bgColor.toLowerCase().startsWith('#2');
  const accentColor = page.accentColorOverride || identity.accentColor || '#8B3DFF';
  const headingFont = identity.headingFont || "'Plus Jakarta Sans', system-ui, sans-serif";
  const bodyFont = identity.bodyFont || "'Plus Jakarta Sans', system-ui, sans-serif";
  const radius = identity.borderRadius ?? 12;

  const visibleElements = (page.elements || [])
    .filter((el) => !el.hidden)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  // Extract special grouped visuals so mobile reads cleanly without duplicates
  const designBlock = visibleElements.find((e) => e.id === 'p1_design_block');
  const designWord = visibleElements.find((e) => e.id === 'p1_design_word');
  const heroImage = visibleElements.find((e) => e.id === 'p1_hero_image');
  const p9Templates = visibleElements.filter((e) => e.id.startsWith('p9_tpl_'));
  const p9Swatches = visibleElements.filter((e) => e.id.startsWith('p9_swatch_'));
  const p10Logos = visibleElements.filter((e) => e.id.startsWith('p10_logo_') && e.type === 'image');
  const p12Posts = visibleElements.filter((e) => e.id.startsWith('p12_post_') && e.type === 'image');

  const handledIds = new Set<string>();
  if (designBlock && heroImage) {
    handledIds.add(designBlock.id);
    if (designWord) handledIds.add(designWord.id);
    handledIds.add(heroImage.id);
  }
  p9Templates.forEach((e) => handledIds.add(e.id));
  p9Swatches.forEach((e) => handledIds.add(e.id));
  p10Logos.forEach((e) => handledIds.add(e.id));
  p12Posts.forEach((e) => handledIds.add(e.id));

  // Detect small top-bar page number ('01'..'16') and header handle so mobile stays super clean
  const topNumEl = visibleElements.find((e) => /^p\d+_num$/.test(e.id));
  const kickerEl = visibleElements.find((e) => /^p\d+_kicker$/.test(e.id));
  const footerTagEl = visibleElements.find((e) => e.id.includes('footer_tag'));

  const handleActionClick = (el: CanvasElement) => {
    if (el.linkAction === 'next-page') {
      onScrollToNext?.();
    } else if (el.linkAction === 'goto-contact') {
      onScrollToContact?.();
    } else if (el.linkAction === 'whatsapp') {
      const url = buildWhatsappUrl(contact);
      if (url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
    } else if (el.linkAction === 'email' && contact.email) {
      window.location.href = `mailto:${contact.email}`;
    } else if (el.linkUrl) {
      window.open(el.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const renderSingleElement = (el: CanvasElement) => {
    const s = el.style || {};

    if (el.type === 'divider' || el.type === 'shape') {
      return null;
    }

    if (el.id === footerTagEl?.id || el.id === topNumEl?.id || el.id === kickerEl?.id) {
      return null;
    }

    if (el.type === 'heading') {
      const baseSize = s.fontSize || 38;
      const mobileSize = Math.min(36, Math.max(24, Math.round(baseSize * 0.68)));
      return (
        <h2
          key={el.id}
          className="font-bold tracking-tight whitespace-pre-line break-words"
          style={{
            fontFamily: s.fontFamily || headingFont,
            fontSize: `${mobileSize}px`,
            lineHeight: 1.15,
            color: s.color || (isDarkSlide ? '#FFFFFF' : identity.textColor),
          }}
        >
          {el.content}
        </h2>
      );
    }

    if (el.type === 'text') {
      const hasSolidBg = Boolean(s.backgroundColor && s.backgroundColor !== 'transparent');
      return (
        <div
          key={el.id}
          className={`whitespace-pre-line break-words leading-relaxed ${
            hasSolidBg ? 'px-4 py-2.5 rounded-lg text-xs font-semibold' : 'text-sm sm:text-base'
          }`}
          style={{
            fontFamily: s.fontFamily || bodyFont,
            color: s.color || (isDarkSlide ? '#E9D5FF' : identity.textColor),
            backgroundColor: hasSolidBg ? s.backgroundColor : undefined,
            textAlign: hasSolidBg ? 'center' : 'left',
          }}
        >
          {el.content}
        </div>
      );
    }

    if (el.type === 'button') {
      return (
        <div key={el.id} className="pt-1">
          <button
            type="button"
            onClick={() => handleActionClick(el)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
            style={{
              fontFamily: s.fontFamily || bodyFont,
              backgroundColor: s.backgroundColor || accentColor,
              color: s.color || '#FFFFFF',
              borderRadius: identity.buttonStyle === 'pill' ? '999px' : `${radius}px`,
            }}
          >
            <span>{el.content || 'Ver más'}</span>
            <ArrowUpRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      );
    }

    if (el.type === 'card') {
      const isPill = (s.borderRadius ?? 10) >= 999 || el.h <= 80;
      const cardHref = normalizeSafeUrl(el.linkUrl);
      return (
        <div
          key={el.id}
          onClick={() => {
            if (cardHref) window.open(cardHref, '_blank', 'noopener,noreferrer');
          }}
          className={`border p-5 space-y-2 ${isPill ? 'text-center py-3 px-5' : ''} ${
            cardHref ? 'cursor-pointer hover:opacity-95' : ''
          }`}
          style={{
            backgroundColor: s.backgroundColor || identity.surfaceColor,
            color: s.color || identity.textColor,
            borderColor: s.borderColor || 'rgba(109,40,217,0.14)',
            borderRadius: isPill ? '999px' : `${radius}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-bold leading-snug break-words"
              style={{
                fontFamily: s.fontFamily || headingFont,
                fontSize: isPill ? '18px' : '19px',
              }}
            >
              {el.content}
            </h3>
            {cardHref && <ArrowUpRight className="w-4 h-4 shrink-0 mt-1" style={{ color: accentColor }} />}
          </div>
          {el.secondaryContent && (
            <p className="text-sm opacity-90 whitespace-pre-line leading-relaxed break-words">
              {el.secondaryContent}
            </p>
          )}
        </div>
      );
    }

    if (el.type === 'image') {
      const resolvedImg = resolveAssetUrl(el.mediaUrl);
      const hasValidImage = Boolean(resolvedImg) && !brokenImages[el.id];
      const isTransparentCutout = s.backgroundColor === 'transparent';
      const imageHref = normalizeSafeUrl(el.linkUrl);
      const popupAllowed = el.enablePopup !== false;
      const canOpenPopup = hasValidImage && !imageHref && popupAllowed && Boolean(onOpenLightbox);
      return (
        <div
          key={el.id}
          onClick={() => {
            if (imageHref) {
              window.open(imageHref, '_blank', 'noopener,noreferrer');
              return;
            }
            if (canOpenPopup) {
              onOpenLightbox?.({
                id: el.id,
                url: resolvedImg,
                title: el.content || el.name,
                category: page.title,
                mediaType: 'image',
              });
            }
          }}
          className={`relative overflow-hidden ${imageHref ? 'cursor-pointer' : canOpenPopup ? 'cursor-zoom-in' : ''}`}
          style={{
            borderRadius: `${s.borderRadius ?? radius}px`,
            backgroundColor: isTransparentCutout
              ? 'transparent'
              : isDarkSlide
              ? 'rgba(255,255,255,0.1)'
              : '#FFFFFF',
          }}
        >
          {hasValidImage ? (
            <img
              src={resolvedImg}
              alt={el.content || el.name}
              referrerPolicy="no-referrer"
              onError={() => setBrokenImages((prev) => ({ ...prev, [el.id]: true }))}
              className={`w-full max-h-[420px] ${
                s.objectFit === 'contain' ? 'object-contain mx-auto' : 'object-cover'
              }`}
            />
          ) : (
            <div
              className={`py-10 px-4 flex flex-col items-center justify-center text-center gap-2 border border-dashed rounded-xl ${
                isDarkSlide
                  ? 'border-white/25 text-purple-100'
                  : 'border-purple-300 text-purple-900'
              }`}
            >
              <ImageIcon className="w-6 h-6 opacity-50" />
              <span className="text-xs font-medium opacity-80">{el.content || el.name}</span>
            </div>
          )}
        </div>
      );
    }

    if (el.type === 'video') {
      const parsedVideo = parseVideoSource(el.mediaUrl);
      const resolvedPoster = resolveAssetUrl(el.posterUrl);
      const previewThumb =
        resolvedPoster || (parsedVideo.kind === 'iframe' ? parsedVideo.thumbnailUrl || '' : '');
      const videoTarget = resolveVideoClickTarget(
        el.mediaUrl,
        el.videoClickMode,
        el.videoActionLabel
      );
      const shouldDirectLink =
        !videoTarget.isEmpty &&
        (videoTarget.isDownload ||
          el.videoClickMode === 'external' ||
          parsedVideo.kind === 'external' ||
          !onOpenLightbox);
      const topLabelText = videoTarget.isEmpty ? '' : videoTarget.actionLabel;

      const videoCardInner = (
        <>
          {previewThumb && (
            <img
              src={previewThumb}
              alt={el.content || el.name || 'Video'}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-85"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="relative z-10 w-full p-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              {topLabelText && (
                <p className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
                  {topLabelText}
                </p>
              )}
              <p className="text-sm font-medium truncate">
                {el.content || 'Showreel Audiovisual'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-white text-purple-950 flex items-center justify-center shrink-0 shadow">
              {videoTarget.isDownload ? (
                <Download className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </div>
          </div>
        </>
      );

      if (shouldDirectLink) {
        return (
          <a
            key={el.id}
            href={videoTarget.href}
            target="_blank"
            rel="noopener noreferrer"
            download={videoTarget.isDownload ? '' : undefined}
            className="relative overflow-hidden rounded-2xl aspect-video flex items-end bg-[#2E1065] text-white cursor-pointer"
          >
            {videoCardInner}
          </a>
        );
      }

      return (
        <div
          key={el.id}
          onClick={() => {
            if (videoTarget.isEmpty) return;
            onOpenLightbox?.({
              id: el.id,
              url: el.mediaUrl || '',
              videoUrl: el.mediaUrl || '',
              videoAction: el.videoClickMode || 'online',
              videoActionLabel: el.videoActionLabel,
              title: el.content || el.name || 'Video',
              category: page.title,
              mediaType: 'video',
            });
          }}
          className={`relative overflow-hidden rounded-2xl aspect-video flex items-end bg-[#2E1065] text-white ${
            !videoTarget.isEmpty ? 'cursor-pointer' : ''
          }`}
        >
          {videoCardInner}
        </div>
      );
    }

    if (el.type === 'stats-row') {
      const stats = el.statsItems || [];
      return (
        <div key={el.id} className="grid grid-cols-2 gap-3">
          {stats.map((st) => (
            <div
              key={st.id}
              className="p-4 border space-y-1"
              style={{
                backgroundColor: s.backgroundColor || '#FFFFFF',
                borderColor: '#E9D5FF',
                borderRadius: `${radius}px`,
              }}
            >
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: headingFont, color: s.color || identity.primaryColor }}
              >
                {st.value}
              </div>
              <div className="text-xs leading-snug" style={{ color: identity.mutedTextColor }}>
                {st.label}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (el.type === 'services-grid') {
      const visibleServices = services.filter((srv) => srv.visible).slice(0, 12);
      return (
        <div key={el.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleServices.map((srv, idx) => (
            <div
              key={srv.id}
              className="p-4 border space-y-2 bg-white text-purple-950"
              style={{ borderColor: 'rgba(109,40,217,0.14)', borderRadius: `${radius}px` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono tabular-nums font-bold" style={{ color: accentColor }}>
                  {srv.number || String(idx + 1).padStart(2, '0')}
                </span>
                {srv.category && (
                  <span className="text-[11px] text-purple-900/60">{srv.category}</span>
                )}
              </div>
              <h3 className="text-base font-bold leading-snug" style={{ fontFamily: headingFont }}>
                {srv.title}
              </h3>
              <p className="text-xs leading-relaxed text-purple-950/75">{srv.description}</p>
              {srv.deliverables && srv.deliverables.length > 0 && (
                <div className="pt-2 border-t border-purple-100 text-[11px] text-purple-900/70">
                  {srv.deliverables.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (el.type === 'packages-grid') {
      const category = el.packageCategory || 'branding';
      const filtered = packages.filter((p) => p.visible && p.category === category).slice(0, 4);
      return (
        <div key={el.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((pkg) => {
            const hasPrice = Boolean(pkg.price && pkg.price.trim().length > 0);
            const whatsappHref = buildWhatsappUrl(
              contact,
              `Hola, me interesa información sobre el paquete "${pkg.name}".`
            );
            const isShortCurrency = pkg.currency === '$';

            return (
              <div
                key={pkg.id}
                className={`p-5 border bg-white text-purple-950 flex flex-col justify-between gap-4 ${
                  pkg.isPopular ? 'ring-2 ring-purple-300 shadow-lg' : 'shadow-sm'
                }`}
                style={{
                  borderColor: pkg.isPopular ? accentColor : 'rgba(109,40,217,0.16)',
                  borderRadius: `${radius}px`,
                }}
              >
                <div className="space-y-3">
                  {pkg.isPopular && (
                    <span
                      className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      {pkg.promoLabel || 'Más Popular'}
                    </span>
                  )}
                  <h3 className="text-base font-bold uppercase text-[#2E1065]" style={{ fontFamily: headingFont }}>
                    {pkg.name}
                  </h3>
                  <div className="pb-2 border-b border-purple-100">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span
                        className="text-2xl font-extrabold tabular-nums"
                        style={{ fontFamily: headingFont, color: accentColor }}
                      >
                        {hasPrice
                          ? isShortCurrency
                            ? `$${pkg.price}`
                            : `${pkg.currency} ${pkg.price}`
                          : 'A consultar'}
                      </span>
                      {pkg.billingPeriod && (
                        <span className="text-xs text-purple-900/60">/ {pkg.billingPeriod}</span>
                      )}
                    </div>
                    {pkg.description && (
                      <p className="text-[11px] uppercase tracking-wide text-purple-950/70 mt-1 font-medium">
                        {pkg.description}
                      </p>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {(pkg.features || []).slice(0, 6).map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs leading-snug text-purple-950">
                        <CheckCircle2
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: identity.secondaryColor }}
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(ev) => {
                    if (whatsappHref === '#') {
                      ev.preventDefault();
                      onScrollToContact?.();
                    }
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 text-white"
                  style={{
                    backgroundColor: pkg.isPopular ? accentColor : identity.primaryColor,
                    borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                  }}
                >
                  <span>{el.content?.trim() || 'Solicitar plan'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      );
    }

    if (el.type === 'testimonials-grid') {
      const visibleTestimonials = testimonials.filter((t) => t.visible).slice(0, 4);
      return (
        <div key={el.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleTestimonials.map((item) => (
            <div
              key={item.id}
              className="p-5 border bg-white text-purple-950 flex flex-col justify-between gap-4"
              style={{ borderColor: 'rgba(109,40,217,0.14)', borderRadius: `${radius}px` }}
            >
              <div className="space-y-2">
                {item.resultMetric && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
                    {item.resultMetric}
                  </p>
                )}
                <p className="text-base leading-relaxed" style={{ fontFamily: headingFont }}>
                  “{item.quote}”
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-purple-100">
                {item.avatarUrl ? (
                  <img
                    src={resolveAssetUrl(item.avatarUrl)}
                    alt={item.clientName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center text-xs font-bold shrink-0">
                    {item.clientName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{item.clientName}</div>
                  <div className="text-xs text-purple-900/65 truncate">
                    {[item.clientRole, item.company].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (el.type === 'gallery') {
      const items = el.galleryItems || [];
      const isLogoMode = s.objectFit === 'contain';
      const categories = ['Todos', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))];
      const shown = galleryFilter === 'Todos' ? items : items.filter((i) => i.category === galleryFilter);

      return (
        <div key={el.id} className="space-y-3">
          {categories.length > 2 && !isLogoMode && (
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGalleryFilter(cat)}
                  className="px-3 py-1 text-xs font-medium rounded-full cursor-pointer"
                  style={{
                    backgroundColor: galleryFilter === cat ? accentColor : 'rgba(109,40,217,0.12)',
                    color: galleryFilter === cat ? '#FFFFFF' : isDarkSlide ? '#FFFFFF' : '#4C1D95',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className={`grid gap-3 ${isLogoMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {shown.map((item) => {
              const videoLink = item.videoUrl || (item.mediaType === 'video' ? item.url : '');
              const isVideoItem = Boolean(videoLink) || item.mediaType === 'video';
              const parsedItemVideo = videoLink ? parseVideoSource(videoLink) : null;
              const videoTarget = isVideoItem
                ? resolveVideoClickTarget(videoLink, item.videoAction, item.videoActionLabel)
                : null;
              const rawThumb =
                item.url && item.url !== videoLink
                  ? item.url
                  : parsedItemVideo?.kind === 'iframe' && parsedItemVideo.thumbnailUrl
                  ? parsedItemVideo.thumbnailUrl
                  : isVideoItem
                  ? ''
                  : item.url;
              const itemUrl = resolveAssetUrl(rawThumb);
              const hasValid = Boolean(itemUrl) && !brokenImages[item.id];
              const itemPopupAllowed = item.enablePopup !== false;
              const shouldDirectVideoLink =
                isVideoItem &&
                videoTarget &&
                !videoTarget.isEmpty &&
                (videoTarget.isDownload ||
                  item.videoAction === 'external' ||
                  parsedItemVideo?.kind === 'external' ||
                  !onOpenLightbox);
              const canClick =
                (isVideoItem && Boolean(videoTarget && !videoTarget.isEmpty)) ||
                (hasValid && !isVideoItem && itemPopupAllowed);

              const inner = hasValid ? (
                isLogoMode ? (
                  <img
                    src={itemUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    <img
                      src={itemUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <div className="relative z-10 p-2.5 text-white">
                      {isVideoItem && videoTarget && !videoTarget.isEmpty && videoTarget.actionLabel && (
                        <div className="text-[9px] uppercase tracking-wider text-amber-300 font-semibold truncate">
                          {videoTarget.actionLabel}
                        </div>
                      )}
                      <div className="text-[11px] font-semibold truncate">{item.title}</div>
                    </div>
                    {(isVideoItem || itemPopupAllowed) && (
                      <div className="absolute top-2 right-2 bg-black/65 text-white p-1 rounded">
                        {isVideoItem ? (
                          videoTarget?.isDownload ? (
                            <Download className="w-3 h-3" />
                          ) : (
                            <VideoIcon className="w-3 h-3" />
                          )
                        ) : (
                          <Expand className="w-3 h-3" />
                        )}
                      </div>
                    )}
                  </>
                )
              ) : (
                <div
                  className={`p-2 text-center flex flex-col items-center justify-center h-full ${
                    isLogoMode ? 'text-[#3B0764]' : isDarkSlide ? 'text-purple-100' : 'text-purple-900'
                  }`}
                >
                  {isVideoItem ? (
                    videoTarget?.isDownload ? (
                      <Download className="w-4 h-4 opacity-70 mb-1" />
                    ) : (
                      <Play className="w-4 h-4 opacity-70 mb-1" />
                    )
                  ) : (
                    !isLogoMode && <ImageIcon className="w-4 h-4 opacity-45 mb-1" />
                  )}
                  <span className="text-[11px] font-bold leading-tight line-clamp-2">{item.title}</span>
                </div>
              );

              if (shouldDirectVideoLink && videoTarget) {
                return (
                  <a
                    key={item.id}
                    href={videoTarget.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={videoTarget.isDownload ? '' : undefined}
                    className={`relative overflow-hidden border cursor-pointer ${
                      isLogoMode
                        ? 'aspect-square bg-white p-2.5 flex items-center justify-center'
                        : 'aspect-[4/5] flex flex-col justify-end'
                    }`}
                    style={{
                      borderRadius: `${radius}px`,
                      borderColor: isDarkSlide && !isLogoMode ? 'rgba(255,255,255,0.18)' : 'rgba(109,40,217,0.14)',
                      backgroundColor: isLogoMode ? '#FFFFFF' : isDarkSlide ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                    }}
                  >
                    {inner}
                  </a>
                );
              }

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!canClick) return;
                    if (isVideoItem && videoLink) {
                      onOpenLightbox?.({
                        ...item,
                        url: videoLink,
                        videoUrl: videoLink,
                        videoAction: item.videoAction,
                        mediaType: 'video',
                      });
                    } else {
                      onOpenLightbox?.({ ...item, url: itemUrl });
                    }
                  }}
                  className={`relative overflow-hidden border ${
                    isLogoMode
                      ? 'aspect-square bg-white p-2.5 flex items-center justify-center'
                      : 'aspect-[4/5] flex flex-col justify-end'
                  } ${canClick ? 'cursor-pointer' : ''}`}
                  style={{
                    borderRadius: `${radius}px`,
                    borderColor: isDarkSlide && !isLogoMode ? 'rgba(255,255,255,0.18)' : 'rgba(109,40,217,0.14)',
                    backgroundColor: isLogoMode ? '#FFFFFF' : isDarkSlide ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                  }}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (el.type === 'contact-block') {
      const waUrl = buildWhatsappUrl(contact);
      const hasWa = Boolean(contact.whatsappNumber);
      const channels = [
        { label: 'Instagram', url: contact.instagramUrl, icon: Instagram },
        { label: 'Facebook', url: contact.facebookUrl, icon: Facebook },
        { label: 'TikTok', url: contact.tiktokUrl, icon: Globe },
        { label: 'Sitio Web', url: contact.websiteUrl, icon: Globe },
      ].filter((c) => Boolean(c.url));

      return (
        <div
          key={el.id}
          className="p-5 border bg-white text-purple-950 space-y-4"
          style={{ borderColor: 'rgba(109,40,217,0.14)', borderRadius: `${radius}px` }}
        >
          <div className="grid grid-cols-1 gap-3">
            <a
              href={hasWa ? waUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(ev) => !hasWa && ev.preventDefault()}
              className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white"
              style={{
                backgroundColor: identity.primaryColor,
                borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
              }}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{hasWa ? 'Escribir por WhatsApp' : 'Configurar WhatsApp'}</span>
            </a>
            <a
              href={contact.email ? `mailto:${contact.email}` : undefined}
              onClick={(ev) => !contact.email && ev.preventDefault()}
              className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold border border-purple-200 text-purple-950"
              style={{
                borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
              }}
            >
              <Mail className="w-4 h-4" />
              <span className="truncate">{contact.email || 'Configurar correo'}</span>
            </a>
          </div>

          <div className="pt-3 border-t border-purple-100 space-y-2">
            <div>
              <div className="text-sm font-bold">{contact.professionalName || contact.studioName}</div>
              <div className="text-xs text-purple-900/70">
                {[contact.specialty, contact.location].filter(Boolean).join(' · ')}
              </div>
            </div>
            {channels.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {channels.map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <a
                      key={ch.label}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-800 hover:underline"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{ch.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="px-5 py-12 space-y-6"
      style={{
        fontFamily: bodyFont,
        color: isDarkSlide ? '#FFFFFF' : identity.textColor,
      }}
    >
      {/* Section Header Kicker + Counter */}
      {(kickerEl || topNumEl) && (
        <div className="flex items-center justify-between gap-3">
          {kickerEl && (
            <span
              className="text-xs font-bold uppercase tracking-[0.12em]"
              style={{ color: isDarkSlide ? '#E9D5FF' : accentColor }}
            >
              {kickerEl.content}
            </span>
          )}
          {topNumEl && (
            <span
              className="text-xs font-mono font-bold opacity-70"
              style={{ color: isDarkSlide ? '#FFFFFF' : '#4C1D95' }}
            >
              {topNumEl.content}
            </span>
          )}
        </div>
      )}

      {/* Standard ordered flow for unhandled elements */}
      <div className="space-y-4">
        {visibleElements.map((el) => {
          if (handledIds.has(el.id)) return null;
          return renderSingleElement(el);
        })}
      </div>

      {/* Special Hero Block for Page 01 (3D keycap + transparent PNG overlay) */}
      {designBlock && heroImage && (
        <div className="relative pt-14 mt-4 flex justify-center">
          <div
            className="w-full max-w-[320px] h-[200px] rounded-[36px] flex items-end justify-center pb-8 shadow-2xl border-2 border-white/25 relative"
            style={{
              background: `linear-gradient(155deg, #B794F4 0%, ${designBlock.style?.backgroundColor || '#8B5CF6'} 42%, #6D28D9 100%)`,
            }}
          >
            <span
              className="text-5xl font-bold tracking-tight text-white select-none"
              style={{ fontFamily: headingFont }}
            >
              {designWord?.content || 'design'}
            </span>
          </div>
          {heroImage.mediaUrl ? (
            <img
              src={resolveAssetUrl(heroImage.mediaUrl)}
              alt={heroImage.content || 'Portada'}
              referrerPolicy="no-referrer"
              className="absolute -top-2 w-56 h-56 object-contain pointer-events-none drop-shadow-[0_14px_24px_rgba(20,6,46,0.42)]"
            />
          ) : null}
        </div>
      )}

      {/* Special 3x3 Template Showcase + Swatches for Page 09 */}
      {p9Templates.length > 0 && (
        <div className="space-y-4 pt-2">
          {p9Swatches.length > 0 && (
            <div className="flex items-center gap-3">
              {p9Swatches.map((sw) => (
                <div
                  key={sw.id}
                  className="w-9 h-9 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: sw.style?.backgroundColor || '#FFFFFF' }}
                />
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {p9Templates.map((tpl) => {
              const tplUrl = resolveAssetUrl(tpl.mediaUrl);
              const hasImg = Boolean(tplUrl) && !brokenImages[tpl.id];
              const canPopup = hasImg && tpl.enablePopup !== false;
              return (
                <div
                  key={tpl.id}
                  onClick={() =>
                    canPopup &&
                    onOpenLightbox?.({
                      id: tpl.id,
                      url: tplUrl,
                      title: tpl.content || tpl.name,
                      category: 'Plantilla',
                      mediaType: 'image',
                    })
                  }
                  className={`aspect-[3/4] rounded-lg overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center ${
                    canPopup ? 'cursor-zoom-in' : ''
                  }`}
                >
                  {hasImg ? (
                    <img
                      src={tplUrl}
                      alt={tpl.content || tpl.name}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [tpl.id]: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-center px-1.5 text-purple-100/80">
                      {tpl.content || tpl.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Special Logo Grid for Page 10 (individual resizable desktop logo elements) */}
      {p10Logos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {p10Logos.map((logoEl) => {
            const logoUrl = resolveAssetUrl(logoEl.mediaUrl);
            const hasImg = Boolean(logoUrl) && !brokenImages[logoEl.id];
            const logoHref = normalizeSafeUrl(logoEl.linkUrl);
            const canLogoPopup = hasImg && !logoHref && logoEl.enablePopup !== false;
            return (
              <div
                key={logoEl.id}
                onClick={() => {
                  if (logoHref) {
                    window.open(logoHref, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  if (canLogoPopup) {
                    onOpenLightbox?.({
                      id: logoEl.id,
                      url: logoUrl,
                      title: logoEl.content || logoEl.name,
                      category: 'Logofolio',
                      mediaType: 'image',
                    });
                  }
                }}
                className={`aspect-square rounded-xl border border-purple-200/70 bg-white p-2.5 flex items-center justify-center overflow-hidden ${
                  logoHref ? 'cursor-pointer' : canLogoPopup ? 'cursor-zoom-in' : ''
                }`}
              >
                {hasImg ? (
                  <img
                    src={logoUrl}
                    alt={logoEl.content || logoEl.name}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [logoEl.id]: true }))}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] font-bold text-center text-[#3B0764] leading-tight line-clamp-2">
                    {logoEl.content || logoEl.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Special Post Grid for Page 12 */}
      {p12Posts.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {p12Posts.map((post) => {
            const postUrl = resolveAssetUrl(post.mediaUrl);
            const hasImg = Boolean(postUrl) && !brokenImages[post.id];
            const isWide = post.w > 350;
            const canPostPopup = hasImg && post.enablePopup !== false;
            return (
              <div
                key={post.id}
                onClick={() =>
                  canPostPopup &&
                  onOpenLightbox?.({
                    id: post.id,
                    url: postUrl,
                    title: post.content || post.name,
                    category: 'Post',
                    mediaType: 'image',
                  })
                }
                className={`rounded-lg overflow-hidden bg-white border border-purple-200 flex items-center justify-center ${
                  isWide ? 'col-span-2 aspect-[2.6/1]' : 'aspect-[4/3]'
                } ${canPostPopup ? 'cursor-zoom-in' : ''}`}
              >
                {hasImg ? (
                  <img
                    src={postUrl}
                    alt={post.content || post.name}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [post.id]: true }))}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] text-purple-900/70 px-2 text-center">
                    {post.content || post.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {footerTagEl && (
        <div className="pt-2 text-[11px] font-semibold tracking-wider opacity-75">
          {footerTagEl.content}
        </div>
      )}
    </div>
  );
};
