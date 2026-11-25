import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  Expand,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  Lock,
  Mail,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Trash2,
  Ungroup,
  Upload,
  Video as VideoIcon,
  X,
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

export interface SlideRendererProps {
  page: PortfolioPage;
  identity: VisualIdentity;
  contact: ContactConfig;
  services: ServiceItem[];
  packages: PackageItem[];
  testimonials: TestimonialItem[];
  editMode?: boolean;
  panMode?: boolean;
  selectedElementId?: string | null;
  snapToGrid?: boolean;
  fixedWidth?: number; // Useful for crisp off-screen PDF rendering at 1280px
  onSelectElement?: (elementId: string | null) => void;
  onUpdateElement?: (elementId: string, patch: Partial<CanvasElement>, commitHistory?: boolean) => void;
  onQuickUploadElement?: (el: CanvasElement) => void;
  onQuickPickMedia?: (el: CanvasElement) => void;
  onQuickEditDynamic?: (el: CanvasElement, itemId?: string) => void;
  onSplitDynamicBlock?: (el: CanvasElement) => void;
  onInlineUpdatePackage?: (pkg: PackageItem, immediate?: boolean) => void;
  onInlineUpdateService?: (srv: ServiceItem, immediate?: boolean) => void;
  onInlineUpdateTestimonial?: (item: TestimonialItem, immediate?: boolean) => void;
  onInlineUpdateContact?: (patch: Partial<ContactConfig>, immediate?: boolean) => void;
  onDuplicateElement?: (el: CanvasElement) => void;
  onDeleteElement?: (elementId: string) => void;
  onNextPage?: () => void;
  onGotoContact?: () => void;
  onOpenLightbox?: (item: GalleryMediaItem) => void;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  sm: '0 4px 16px rgba(20, 20, 19, 0.06)',
  md: '0 12px 32px rgba(20, 20, 19, 0.12)',
  lg: '0 24px 56px rgba(20, 20, 19, 0.18)',
};

function buildWhatsappUrl(contact: ContactConfig, customMessage?: string): string {
  const digits = (contact.whatsappNumber || '').replace(/\D/g, '');
  const text = encodeURIComponent(customMessage || contact.whatsappDefaultMessage || 'Hola, me interesa cotizar un servicio.');
  if (!digits) return '#';
  return `https://wa.me/${digits}?text=${text}`;
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({
  page,
  identity,
  contact,
  services,
  packages,
  testimonials,
  editMode = false,
  panMode = false,
  selectedElementId = null,
  snapToGrid = true,
  fixedWidth,
  onSelectElement,
  onUpdateElement,
  onQuickUploadElement,
  onQuickPickMedia,
  onQuickEditDynamic,
  onSplitDynamicBlock,
  onInlineUpdatePackage,
  onInlineUpdateService,
  onInlineUpdateTestimonial,
  onInlineUpdateContact,
  onDuplicateElement,
  onDeleteElement,
  onNextPage,
  onGotoContact,
  onOpenLightbox,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(fixedWidth ? fixedWidth / CANVAS_W : 1);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const onUpdateElementRef = useRef(onUpdateElement);
  onUpdateElementRef.current = onUpdateElement;

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [galleryFilter, setGalleryFilter] = useState<string>('Todos');
  const [guides, setGuides] = useState<{ vCenter: boolean; hCenter: boolean }>({ vCenter: false, hCenter: false });
  const [activeHud, setActiveHud] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (fixedWidth) {
      setScale(fixedWidth / CANVAS_W);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) {
        const sW = w / CANVAS_W;
        const sH = h > 0 ? h / CANVAS_H : sW;
        setScale(Math.min(sW, sH));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedWidth]);

  useEffect(() => {
    setGalleryFilter('Todos');
    setEditingTextId(null);
    setActiveHud(null);
  }, [page.id]);

  const bgColor = page.backgroundColor || identity.backgroundColor || '#F8F6FC';
  const bgGradient = page.backgroundGradient || '';
  const isDarkSlide = Boolean(bgGradient) || bgColor.toLowerCase().startsWith('#4') || bgColor.toLowerCase().startsWith('#5') || bgColor.toLowerCase().startsWith('#6') || bgColor.toLowerCase().startsWith('#1') || bgColor.toLowerCase().startsWith('#2');
  const accentColor = page.accentColorOverride || identity.accentColor || '#8B3DFF';
  const headingFont = identity.headingFont || "'Plus Jakarta Sans', system-ui, sans-serif";
  const bodyFont = identity.bodyFont || "'Plus Jakarta Sans', system-ui, sans-serif";
  const fontScale = identity.baseFontScale || 1;

  const sortedElements = [...(page.elements || [])]
    .filter((el) => !el.hidden)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const startDrag = (e: React.PointerEvent, el: CanvasElement) => {
    if (!editMode || panMode || e.button !== 0 || editingTextId === el.id) return;
    e.stopPropagation();
    onSelectElement?.(el.id);
    if (el.locked) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    let latestX = origX;
    let latestY = origY;
    let moved = false;

    const computePos = (ev: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dx = (ev.clientX - startX) / s;
      const dy = (ev.clientY - startY) / s;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

      let nextX = origX + dx;
      let nextY = origY + dy;

      if (snapToGrid && !ev.altKey) {
        nextX = Math.round(nextX / 8) * 8;
        nextY = Math.round(nextY / 8) * 8;
      }

      // Magnetic snap to canvas center & edges
      const centerX = nextX + el.w / 2;
      const centerY = nextY + el.h / 2;
      const vCenter = !ev.altKey && Math.abs(centerX - CANVAS_W / 2) < 8;
      const hCenter = !ev.altKey && Math.abs(centerY - CANVAS_H / 2) < 8;
      if (vCenter) nextX = Math.round(CANVAS_W / 2 - el.w / 2);
      if (hCenter) nextY = Math.round(CANVAS_H / 2 - el.h / 2);

      return {
        x: Math.round(nextX),
        y: Math.round(nextY),
        vCenter,
        hCenter,
      };
    };

    const handleMove = (ev: PointerEvent) => {
      const pos = computePos(ev);
      latestX = pos.x;
      latestY = pos.y;
      setGuides({ vCenter: pos.vCenter, hCenter: pos.hCenter });
      if (moved) {
        setActiveHud({ id: el.id, text: `X: ${latestX} · Y: ${latestY}` });
        onUpdateElementRef.current?.(el.id, { x: latestX, y: latestY }, false);
      }
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setGuides({ vCenter: false, hCenter: false });
      setActiveHud(null);
      const pos = computePos(ev);
      if (moved) {
        latestX = pos.x;
        latestY = pos.y;
        onUpdateElementRef.current?.(el.id, { x: latestX, y: latestY }, true);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const startResize = (
    e: React.PointerEvent,
    el: CanvasElement,
    dir: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
  ) => {
    if (!editMode || panMode || el.locked || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: el.x, y: el.y, w: el.w, h: el.h };
    const origRatio = orig.h > 0 ? orig.w / orig.h : 1;
    const isCorner = dir === 'nw' || dir === 'ne' || dir === 'sw' || dir === 'se';
    let latestRect = { ...orig };

    const computeRect = (ev: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dx = (ev.clientX - startX) / s;
      const dy = (ev.clientY - startY) / s;
      let { x, y, w, h } = orig;

      if (dir.includes('e')) w = Math.max(36, orig.w + dx);
      if (dir.includes('s')) h = Math.max(12, orig.h + dy);
      if (dir.includes('w')) {
        const nextW = Math.max(36, orig.w - dx);
        x = orig.x + (orig.w - nextW);
        w = nextW;
      }
      if (dir.includes('n')) {
        const nextH = Math.max(12, orig.h - dy);
        y = orig.y + (orig.h - nextH);
        h = nextH;
      }

      // Keep aspect ratio on corner drag for cover photos (Shift = free),
      // while contain-fit logos/cutouts resize freely by default (Shift = proportional)
      const isContainImage = el.type === 'image' && el.style?.objectFit === 'contain';
      const lockAspectRatio = isContainImage ? ev.shiftKey : !ev.shiftKey;
      if (isCorner && el.type === 'image' && lockAspectRatio && origRatio > 0) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          const nextH = Math.max(20, w / origRatio);
          if (dir.includes('n')) y = orig.y + (orig.h - nextH);
          h = nextH;
        } else {
          const nextW = Math.max(20, h * origRatio);
          if (dir.includes('w')) x = orig.x + (orig.w - nextW);
          w = nextW;
        }
      }

      if (snapToGrid && !ev.altKey) {
        x = Math.round(x / 4) * 4;
        y = Math.round(y / 4) * 4;
        w = Math.round(w / 4) * 4;
        h = Math.round(h / 4) * 4;
      } else {
        x = Math.round(x);
        y = Math.round(y);
        w = Math.round(w);
        h = Math.round(h);
      }

      return { x, y, w, h };
    };

    const handleMove = (ev: PointerEvent) => {
      latestRect = computeRect(ev);
      setActiveHud({ id: el.id, text: `${latestRect.w} × ${latestRect.h}` });
      onUpdateElementRef.current?.(el.id, latestRect, false);
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setActiveHud(null);
      latestRect = computeRect(ev);
      onUpdateElementRef.current?.(el.id, latestRect, true);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const renderDecorativeBackground = () => {
    if (page.backgroundImage) {
      return (
        <img
          src={resolveAssetUrl(page.backgroundImage)}
          alt=""
          draggable={false}
          onDragStart={(ev) => ev.preventDefault()}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none select-none"
        />
      );
    }
    if (identity.decorativeBackground === 'grid') {
      return (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: isDarkSlide
                ? 'linear-gradient(to right, rgba(255,255,255,0.065) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.065) 1px, transparent 1px)'
                : 'linear-gradient(to right, rgba(109,40,217,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(109,40,217,0.055) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          {isDarkSlide && (
            <div
              className="absolute -top-32 -right-24 w-[620px] h-[620px] rounded-full pointer-events-none opacity-25 blur-3xl"
              style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)' }}
            />
          )}
        </>
      );
    }
    if (identity.decorativeBackground === 'editorial-lines') {
      return (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 bottom-0 left-[72px] w-px opacity-[0.06]"
            style={{ backgroundColor: identity.textColor }}
          />
          <div
            className="absolute top-0 bottom-0 right-[72px] w-px opacity-[0.06]"
            style={{ backgroundColor: identity.textColor }}
          />
        </div>
      );
    }
    if (identity.decorativeBackground === 'warm-glow') {
      return (
        <div
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full pointer-events-none opacity-[0.09] blur-3xl"
          style={{ backgroundColor: accentColor }}
        />
      );
    }
    return null;
  };

  const renderElementContent = (el: CanvasElement) => {
    const isEditingThis = editMode && editingTextId === el.id;
    const s = el.style || {};
    const radius = s.borderRadius ?? identity.borderRadius ?? 10;
    const shadow = s.shadow ? SHADOW_MAP[s.shadow] : undefined;

    if (el.type === 'divider') {
      return (
        <div
          className="w-full h-full"
          style={{
            backgroundColor: s.backgroundColor || identity.textColor,
            opacity: s.opacity ?? 0.2,
            borderRadius: radius,
          }}
        />
      );
    }

    if (el.type === 'shape') {
      const isDesignKeycap = el.id === 'p1_design_block';
      const baseBg = s.backgroundColor || accentColor;
      return (
        <div
          className="w-full h-full relative"
          style={{
            backgroundColor: baseBg,
            background: isDesignKeycap
              ? `linear-gradient(155deg, #B794F4 0%, ${baseBg} 42%, #6D28D9 100%)`
              : baseBg,
            borderColor: s.borderColor,
            borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
            borderStyle: s.borderWidth ? 'solid' : undefined,
            borderRadius: radius,
            opacity: s.opacity ?? 1,
            boxShadow: isDesignKeycap
              ? '0 28px 60px rgba(20, 6, 46, 0.45), inset 0 6px 16px rgba(255, 255, 255, 0.35)'
              : shadow,
          }}
        >
          {isDesignKeycap && (
            <div
              className="absolute inset-[18px] pointer-events-none"
              style={{
                borderRadius: Math.max(12, Number(radius) - 14),
                background: `linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(124,58,237,0.22) 100%)`,
                boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.28), 0 8px 24px rgba(46,16,101,0.28)',
              }}
            />
          )}
        </div>
      );
    }

    if (el.type === 'heading' || el.type === 'text') {
      const fontFamily =
        s.fontFamily || (el.type === 'heading' ? headingFont : bodyFont);
      const fontSize = (s.fontSize || (el.type === 'heading' ? 42 : 16)) * fontScale;
      const color = s.color || identity.textColor;

      if (isEditingThis) {
        return (
          <textarea
            autoFocus
            value={el.content || ''}
            onChange={(ev) => onUpdateElement?.(el.id, { content: ev.target.value }, false)}
            onBlur={() => {
              setEditingTextId(null);
              onUpdateElement?.(el.id, {}, true);
            }}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full h-full bg-white/80 text-stone-900 p-1 rounded outline-2 outline-amber-600 resize-none"
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight: s.fontWeight || (el.type === 'heading' ? 600 : 400),
              lineHeight: s.lineHeight || 1.25,
              letterSpacing: s.letterSpacing,
              textAlign: s.textAlign || 'left',
            }}
          />
        );
      }

      const hasSolidBg = Boolean(s.backgroundColor && s.backgroundColor !== 'transparent');

      return (
        <div
          onDoubleClick={(ev) => {
            if (!editMode || el.locked) return;
            ev.stopPropagation();
            setEditingTextId(el.id);
          }}
          className={`w-full h-full whitespace-pre-wrap break-words ${
            hasSolidBg ? 'overflow-hidden' : 'overflow-visible'
          }`}
          style={{
            fontFamily,
            fontSize: `${fontSize}px`,
            fontWeight: s.fontWeight || (el.type === 'heading' ? 600 : 400),
            lineHeight: s.lineHeight || (el.type === 'heading' ? 1.15 : 1.5),
            letterSpacing: s.letterSpacing,
            textAlign: s.textAlign || 'left',
            color,
            backgroundColor: s.backgroundColor,
            padding: s.padding ? `${s.padding}px` : undefined,
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined,
            textTransform: s.textTransform || 'none',
            textWrap: el.type === 'heading' ? 'balance' : undefined,
          }}
        >
          {el.content}
        </div>
      );
    }

    if (el.type === 'button') {
      const btnRadius =
        identity.buttonStyle === 'pill'
          ? 999
          : identity.buttonStyle === 'sharp'
          ? 2
          : s.borderRadius ?? 8;

      const handleClick = (ev: React.MouseEvent) => {
        if (editMode) {
          ev.preventDefault();
          return;
        }
        if (el.linkAction === 'next-page') {
          onNextPage?.();
        } else if (el.linkAction === 'goto-contact') {
          onGotoContact?.();
        } else if (el.linkAction === 'whatsapp') {
          const url = buildWhatsappUrl(contact);
          if (url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
        } else if (el.linkAction === 'email' && contact.email) {
          window.location.href = `mailto:${contact.email}`;
        } else if (el.linkUrl) {
          window.open(el.linkUrl, '_blank', 'noopener,noreferrer');
        }
      };

      return (
        <button
          type="button"
          onClick={handleClick}
          onDoubleClick={(ev) => {
            if (!editMode || el.locked) return;
            ev.stopPropagation();
            setEditingTextId(el.id);
          }}
          className="w-full h-full flex items-center justify-center gap-2 transition-transform duration-150 hover:opacity-90 cursor-pointer whitespace-nowrap px-4"
          style={{
            fontFamily: s.fontFamily || bodyFont,
            fontSize: `${(s.fontSize || 14) * fontScale}px`,
            fontWeight: s.fontWeight || 600,
            backgroundColor: s.backgroundColor || identity.primaryColor,
            color: s.color || '#FFFFFF',
            borderColor: s.borderColor,
            borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
            borderStyle: s.borderWidth ? 'solid' : undefined,
            borderRadius: `${btnRadius}px`,
            boxShadow: shadow,
          }}
        >
          {isEditingThis ? (
            <input
              autoFocus
              value={el.content || ''}
              onChange={(ev) => onUpdateElement?.(el.id, { content: ev.target.value }, false)}
              onBlur={() => {
                setEditingTextId(null);
                onUpdateElement?.(el.id, {}, true);
              }}
              onClick={(ev) => ev.stopPropagation()}
              className="w-full bg-transparent text-center outline-none"
            />
          ) : (
            <>
              <span>{el.content || 'Acción'}</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </>
          )}
        </button>
      );
    }

    if (el.type === 'card') {
      const isPillBanner = (s.borderRadius ?? 10) >= 999 || el.h <= 80;
      const hideBottomAccent = isPillBanner || s.textAlign === 'center' || el.h <= 150;
      const cardHref = normalizeSafeUrl(el.linkUrl);
      return (
        <div
          onClick={(ev) => {
            if (!editMode && cardHref) {
              ev.stopPropagation();
              window.open(cardHref, '_blank', 'noopener,noreferrer');
            }
          }}
          onDoubleClick={(ev) => {
            if (!editMode || el.locked) return;
            ev.stopPropagation();
            setEditingTextId(el.id);
          }}
          className={`w-full h-full flex flex-col overflow-hidden ${
            isPillBanner || s.textAlign === 'center' ? 'justify-center' : 'justify-between'
          } ${!editMode && cardHref ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
          style={{
            backgroundColor: s.backgroundColor || identity.surfaceColor,
            color: s.color || identity.textColor,
            borderRadius: `${radius}px`,
            borderWidth: s.borderWidth ?? 1,
            borderStyle: 'solid',
            borderColor: s.borderColor || 'rgba(109,40,217,0.12)',
            padding: `${s.padding ?? 24}px`,
            boxShadow: shadow,
            textAlign: s.textAlign || 'left',
          }}
        >
          <div className={isPillBanner ? 'min-h-0' : el.h <= 185 ? 'space-y-1.5 min-h-0' : 'space-y-2.5 min-h-0'}>
            {isEditingThis ? (
              <input
                autoFocus
                value={el.content || ''}
                onChange={(ev) => onUpdateElement?.(el.id, { content: ev.target.value }, false)}
                onBlur={() => {
                  setEditingTextId(null);
                  onUpdateElement?.(el.id, {}, true);
                }}
                onClick={(ev) => ev.stopPropagation()}
                className="w-full bg-white/80 text-stone-900 px-2 py-1 rounded outline-2 outline-amber-600"
                style={{
                  fontFamily: s.fontFamily || headingFont,
                  fontSize: `${(s.fontSize || 20) * fontScale}px`,
                  fontWeight: s.fontWeight || 600,
                  textAlign: s.textAlign || 'left',
                }}
              />
            ) : (
              <h3
                className="break-words"
                style={{
                  fontFamily: s.fontFamily || headingFont,
                  fontSize: `${(s.fontSize || 20) * fontScale}px`,
                  fontWeight: s.fontWeight || 600,
                  lineHeight: 1.2,
                }}
              >
                {el.content}
              </h3>
            )}
            {el.secondaryContent && (
              <p
                className="opacity-85 whitespace-pre-line break-words"
                style={{
                  fontFamily: bodyFont,
                  fontSize: `${(el.h <= 185 ? 13.5 : 14) * fontScale}px`,
                  lineHeight: el.h <= 185 ? 1.42 : 1.5,
                }}
              >
                {el.secondaryContent}
              </p>
            )}
          </div>
          {!hideBottomAccent && (
            <div className="flex items-center justify-between gap-2">
              <div
                className="w-8 h-[2px] opacity-45"
                style={{ backgroundColor: accentColor }}
              />
              {cardHref && (
                <ArrowUpRight className="w-4 h-4 opacity-70 shrink-0" style={{ color: accentColor }} />
              )}
            </div>
          )}
        </div>
      );
    }

    if (el.type === 'image') {
      const resolvedUrl = resolveAssetUrl(el.mediaUrl);
      const brokenKey = `${el.id}:${resolvedUrl}`;
      const hasUrl = Boolean(resolvedUrl) && !brokenImages[brokenKey];
      const isTransparent = s.backgroundColor === 'transparent';
      const zoom = s.imageZoom || 1;
      const posX = s.objectPositionX ?? 50;
      const posY = s.objectPositionY ?? 50;
      const imageHref = normalizeSafeUrl(el.linkUrl);
      const popupAllowed = el.enablePopup !== false;
      const canOpenPopup = !editMode && hasUrl && !imageHref && popupAllowed && Boolean(onOpenLightbox);

      if (!hasUrl && isTransparent && !editMode) {
        return <div className="w-full h-full pointer-events-none" />;
      }

      return (
        <div
          onDoubleClick={(ev) => {
            if (!editMode || el.locked) return;
            ev.stopPropagation();
            onQuickUploadElement?.(el);
          }}
          onClick={() => {
            if (editMode) return;
            if (imageHref) {
              window.open(imageHref, '_blank', 'noopener,noreferrer');
              return;
            }
            if (canOpenPopup && onOpenLightbox) {
              onOpenLightbox({
                id: el.id,
                url: resolvedUrl,
                title: el.content || el.name,
                category: page.title,
                mediaType: 'image',
              });
            }
          }}
          className={`w-full h-full relative group select-none ${
            isTransparent && radius === 0 ? 'overflow-visible' : 'overflow-hidden'
          } ${!editMode && imageHref ? 'cursor-pointer' : canOpenPopup ? 'cursor-zoom-in' : ''}`}
          style={{
            borderRadius: `${radius}px`,
            padding: s.padding ? `${s.padding}px` : undefined,
            backgroundColor: isTransparent
              ? 'transparent'
              : s.backgroundColor || (isDarkSlide ? 'rgba(255,255,255,0.12)' : '#EFEAF8'),
            borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
            borderStyle: s.borderWidth ? 'solid' : undefined,
            borderColor: s.borderColor,
            boxShadow: isTransparent ? undefined : shadow,
          }}
        >
          {hasUrl ? (
            <>
              <img
                src={resolvedUrl}
                alt={el.content || el.name}
                draggable={false}
                onDragStart={(ev) => ev.preventDefault()}
                referrerPolicy="no-referrer"
                onError={() => setBrokenImages((prev) => ({ ...prev, [brokenKey]: true }))}
                className={`w-full h-full select-none ${editMode ? 'pointer-events-none' : 'transition-transform duration-300'}`}
                style={{
                  objectFit: s.objectFit || (isTransparent ? 'contain' : 'cover'),
                  objectPosition: `${posX}% ${posY}%`,
                  transform: `scale(${zoom})`,
                  filter:
                    isTransparent && s.shadow && s.shadow !== 'none'
                      ? 'drop-shadow(0 18px 26px rgba(24, 8, 54, 0.38))'
                      : undefined,
                }}
              />
              {!editMode && (imageHref || canOpenPopup) && (
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white p-2 rounded-lg">
                  {imageHref ? <ArrowUpRight className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                </div>
              )}
            </>
          ) : (
            <div
              className={`w-full h-full flex flex-col items-center justify-center gap-1.5 p-4 text-center ${
                isTransparent
                  ? 'border-2 border-dashed border-white/50 bg-white/5 rounded-2xl text-white'
                  : isDarkSlide
                  ? 'text-purple-100/80'
                  : 'text-purple-900/70'
              }`}
            >
              <ImageIcon className="w-6 h-6 opacity-60" />
              <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                {el.content || el.name || 'Imagen editable'}
              </span>
              {editMode && (
                <span className="text-[10px] opacity-80">
                  {isTransparent ? 'Sube tu PNG sin fondo en el panel derecho' : 'Clic para subir imagen o pegar URL'}
                </span>
              )}
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
        !editMode &&
        !videoTarget.isEmpty &&
        (videoTarget.isDownload ||
          el.videoClickMode === 'external' ||
          parsedVideo.kind === 'external' ||
          !onOpenLightbox);
      const topLabelText = videoTarget.isEmpty
        ? editMode
          ? 'Área de Video · Pega enlace del video'
          : ''
        : videoTarget.actionLabel;

      const innerContent = (
        <>
          {previewThumb && (
            <img
              src={previewThumb}
              alt={el.content || 'Video showcase'}
              draggable={false}
              onDragStart={(ev) => ev.preventDefault()}
              referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-[1.03] select-none ${
                editMode ? 'pointer-events-none' : ''
              }`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="relative z-10 p-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              {topLabelText && (
                <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold mb-1">
                  {topLabelText}
                </p>
              )}
              <p className="text-base font-medium leading-snug max-w-md truncate">
                {el.content || 'Haz clic en la imagen para ver o descargar el video'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/95 text-stone-900 flex items-center justify-center shrink-0 shadow-lg transition-transform duration-200 group-hover:scale-105">
              {videoTarget.isDownload ? (
                <Download className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </div>
          </div>
        </>
      );

      if (shouldDirectLink) {
        return (
          <a
            href={videoTarget.href}
            target="_blank"
            rel="noopener noreferrer"
            download={videoTarget.isDownload ? '' : undefined}
            className="w-full h-full overflow-hidden relative flex flex-col justify-end select-none group cursor-pointer"
            style={{
              borderRadius: `${radius}px`,
              backgroundColor: s.backgroundColor || '#141413',
              color: s.color || '#FFFFFF',
              boxShadow: shadow,
            }}
          >
            {innerContent}
          </a>
        );
      }

      return (
        <div
          onDoubleClick={(ev) => {
            if (!editMode || el.locked) return;
            ev.stopPropagation();
            onQuickUploadElement?.(el);
          }}
          onClick={() => {
            if (editMode || videoTarget.isEmpty) return;
            onOpenLightbox?.({
              id: el.id,
              url: el.mediaUrl || '',
              videoUrl: el.mediaUrl || '',
              videoAction: el.videoClickMode || 'online',
              videoActionLabel: el.videoActionLabel,
              title: el.content || el.name,
              category: page.title,
              mediaType: 'video',
            });
          }}
          className={`w-full h-full overflow-hidden relative flex flex-col justify-end select-none group ${
            !editMode && !videoTarget.isEmpty ? 'cursor-pointer' : ''
          }`}
          style={{
            borderRadius: `${radius}px`,
            backgroundColor: s.backgroundColor || '#141413',
            color: s.color || '#FFFFFF',
            boxShadow: shadow,
          }}
        >
          {innerContent}
        </div>
      );
    }

    if (el.type === 'stats-row') {
      const stats = el.statsItems || [];
      return (
        <div
          className="w-full h-full grid gap-5 items-stretch"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, stats.length)}, minmax(0, 1fr))`,
          }}
        >
          {stats.map((st) => (
            <div
              key={st.id}
              className="flex flex-col justify-center space-y-1.5 border"
              style={{
                backgroundColor: s.backgroundColor || identity.surfaceColor,
                borderColor: '#E9D5FF',
                borderRadius: `${radius}px`,
                padding: `${s.padding ?? 20}px`,
              }}
            >
              <div
                className="tabular-nums font-bold"
                style={{
                  fontFamily: headingFont,
                  fontSize: `${30 * fontScale}px`,
                  color: s.color || identity.primaryColor,
                }}
              >
                {st.value}
              </div>
              <div
                className="text-xs leading-snug"
                style={{ fontFamily: bodyFont, color: identity.mutedTextColor }}
              >
                {st.label}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (el.type === 'services-grid') {
      const visibleServices = services.filter((srv) => srv.visible).slice(0, 12);
      const cardBg = s.backgroundColor || identity.surfaceColor;
      const cardText = s.color || identity.textColor;
      if (visibleServices.length === 0) {
        return (
          <div
            onDoubleClick={(ev) => {
              if (editMode && !panMode && onQuickEditDynamic) {
                ev.stopPropagation();
                onQuickEditDynamic(el);
              }
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed text-center text-sm"
            style={{
              backgroundColor: cardBg,
              color: cardText,
              borderColor: 'rgba(109,40,217,0.28)',
              borderRadius: `${radius}px`,
              fontFamily: bodyFont,
            }}
          >
            <span>
              {editMode
                ? 'No hay servicios visibles. Haz clic para crear o editar servicios.'
                : 'Servicios disponibles próximamente.'}
            </span>
            {editMode && !panMode && onQuickEditDynamic && (
              <button
                type="button"
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onQuickEditDynamic(el);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar servicios</span>
              </button>
            )}
          </div>
        );
      }
      return (
        <div
          className="w-full h-full grid grid-cols-4 auto-rows-fr gap-3"
          style={{ fontFamily: bodyFont }}
        >
          {visibleServices.map((srv, idx) => (
            <div
              key={srv.id}
              onDoubleClick={(ev) => {
                if (editMode && !panMode && onQuickEditDynamic) {
                  ev.stopPropagation();
                  onQuickEditDynamic(el, srv.id);
                }
              }}
              className="group/card relative flex flex-col justify-between p-3.5 border min-h-0 overflow-hidden"
              style={{
                backgroundColor: cardBg,
                color: cardText,
                borderColor: s.borderColor || 'rgba(20,20,19,0.08)',
                borderRadius: `${radius}px`,
              }}
            >
              {editMode && !panMode && onQuickEditDynamic && (
                <button
                  type="button"
                  title={`Editar servicio: ${srv.title}`}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onQuickEditDynamic(el, srv.id);
                  }}
                  className={`absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-950/85 hover:bg-amber-600 text-white text-[10px] font-semibold shadow transition-opacity cursor-pointer ${
                    selectedElementId === el.id ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
                  }`}
                >
                  <Pencil className="w-2.5 h-2.5" />
                  <span>Editar</span>
                </button>
              )}
              {editMode && !panMode && onInlineUpdateService ? (
                <>
                  <div className="space-y-1 min-h-0 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2 pr-14">
                      <input
                        type="text"
                        value={srv.number || String(idx + 1).padStart(2, '0')}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          onSelectElement?.(el.id);
                        }}
                        onClick={(ev) => ev.stopPropagation()}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => onInlineUpdateService({ ...srv, number: ev.target.value })}
                        className="w-10 bg-transparent text-[11px] font-mono tabular-nums font-semibold outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                        style={{ color: accentColor }}
                      />
                      <input
                        type="text"
                        placeholder="Categoría"
                        value={srv.category || ''}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          onSelectElement?.(el.id);
                        }}
                        onClick={(ev) => ev.stopPropagation()}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => onInlineUpdateService({ ...srv, category: ev.target.value })}
                        className="flex-1 min-w-0 text-right bg-transparent text-[10px] opacity-75 outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                        style={{ color: cardText }}
                      />
                    </div>
                    <input
                      type="text"
                      value={srv.title}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        onSelectElement?.(el.id);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onInlineUpdateService({ ...srv, title: ev.target.value })}
                      className="w-full bg-transparent font-semibold leading-tight outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                      style={{
                        fontFamily: headingFont,
                        fontSize: `${16 * fontScale}px`,
                        color: cardText,
                      }}
                    />
                    <textarea
                      rows={2}
                      value={srv.description}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        onSelectElement?.(el.id);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onInlineUpdateService({ ...srv, description: ev.target.value })}
                      className="w-full flex-1 bg-transparent text-[11px] leading-snug opacity-80 resize-none outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                      style={{ color: cardText }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Entregables (separados por ·)"
                    value={(srv.deliverables || []).join(' · ')}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onSelectElement?.(el.id);
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                    onDoubleClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) =>
                      onInlineUpdateService({
                        ...srv,
                        deliverables: ev.target.value
                          .split(/[·,]/)
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full pt-1.5 mt-1 border-t bg-transparent text-[10px] shrink-0 opacity-75 outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                    style={{ borderColor: 'rgba(20,20,19,0.07)', color: cardText }}
                  />
                </>
              ) : (
                <>
                  <div className="space-y-1 min-h-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[11px] font-mono tabular-nums font-semibold shrink-0"
                        style={{ color: accentColor }}
                      >
                        {srv.number || String(idx + 1).padStart(2, '0')}
                      </span>
                      {srv.category && (
                        <span className="text-[10px] opacity-65 truncate">
                          {srv.category}
                        </span>
                      )}
                    </div>
                    <h3
                      className="font-semibold leading-tight line-clamp-2"
                      style={{
                        fontFamily: headingFont,
                        fontSize: `${16 * fontScale}px`,
                        color: cardText,
                      }}
                    >
                      {srv.title}
                    </h3>
                    <p className="text-[11px] leading-snug line-clamp-2 opacity-75">
                      {srv.description}
                    </p>
                  </div>
                  {srv.deliverables && srv.deliverables.length > 0 && (
                    <div
                      className="pt-1.5 mt-1 border-t text-[10px] truncate shrink-0 opacity-70"
                      style={{ borderColor: 'rgba(20,20,19,0.07)' }}
                    >
                      {srv.deliverables.join(' · ')}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (el.type === 'packages-grid') {
      const category = el.packageCategory || 'branding';
      const filtered = packages.filter((p) => p.visible && p.category === category).slice(0, 4);
      const cardBg = s.backgroundColor && s.backgroundColor !== 'transparent' ? s.backgroundColor : '#FFFFFF';
      const cardText = s.color || '#3B0764';

      const ctaLabel = el.content?.trim() || 'Solicitar plan';

      if (filtered.length === 0) {
        return (
          <div
            onDoubleClick={(ev) => {
              if (editMode && !panMode && onQuickEditDynamic) {
                ev.stopPropagation();
                onQuickEditDynamic(el);
              }
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed text-center text-sm"
            style={{
              backgroundColor: cardBg,
              color: cardText,
              borderColor: 'rgba(109,40,217,0.28)',
              borderRadius: `${radius}px`,
              fontFamily: bodyFont,
            }}
          >
            <span>
              {editMode
                ? 'No hay paquetes visibles en esta categoría. Haz clic para crear o editar planes.'
                : 'Planes disponibles próximamente.'}
            </span>
            {editMode && !panMode && onQuickEditDynamic && (
              <button
                type="button"
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onQuickEditDynamic(el);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Crear o editar planes</span>
              </button>
            )}
          </div>
        );
      }

      return (
        <div
          className="w-full h-full grid gap-4 items-stretch"
          style={{
            gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, filtered.length))}, minmax(0, 1fr))`,
            fontFamily: bodyFont,
          }}
        >
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
                onDoubleClick={(ev) => {
                  if (editMode && !panMode && onQuickEditDynamic) {
                    ev.stopPropagation();
                    onQuickEditDynamic(el, pkg.id);
                  }
                }}
                className={`group/card flex flex-col justify-between p-5 border relative min-h-0 overflow-hidden transition-transform ${
                  pkg.isPopular ? 'ring-2 ring-purple-300/70 shadow-xl' : 'shadow-md'
                }`}
                style={{
                  backgroundColor: cardBg,
                  color: cardText,
                  borderColor: pkg.isPopular ? accentColor : s.borderColor || 'rgba(109,40,217,0.16)',
                  borderRadius: `${radius}px`,
                }}
              >
                {editMode && !panMode && onQuickEditDynamic && (
                  <button
                    type="button"
                    title={`Editar plan: ${pkg.name}`}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onQuickEditDynamic(el, pkg.id);
                    }}
                    className={`absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-950/90 hover:bg-amber-600 text-white text-[11px] font-semibold shadow-md transition-opacity cursor-pointer ${
                      selectedElementId === el.id ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar plan</span>
                  </button>
                )}
                {editMode && !panMode && onInlineUpdatePackage ? (
                  <>
                    <div className="flex-1 min-h-0 flex flex-col gap-2">
                      {pkg.isPopular && (
                        <input
                          type="text"
                          value={pkg.promoLabel || 'Más Popular'}
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            onSelectElement?.(el.id);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => onInlineUpdatePackage({ ...pkg, promoLabel: ev.target.value })}
                          className="self-start max-w-[160px] px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-white tracking-wide shrink-0 outline-none focus:ring-2 focus:ring-amber-400 cursor-text"
                          style={{ backgroundColor: accentColor }}
                        />
                      )}
                      {!pkg.isPopular && pkg.promoLabel && (
                        <input
                          type="text"
                          value={pkg.promoLabel}
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            onSelectElement?.(el.id);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => onInlineUpdatePackage({ ...pkg, promoLabel: ev.target.value })}
                          className="w-full pr-20 bg-transparent text-[10.5px] font-bold uppercase tracking-wider shrink-0 outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs cursor-text"
                          style={{ color: accentColor }}
                        />
                      )}

                      <div className="shrink-0 pr-20">
                        <input
                          type="text"
                          value={pkg.name}
                          placeholder="NOMBRE DEL PLAN"
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            onSelectElement?.(el.id);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => onInlineUpdatePackage({ ...pkg, name: ev.target.value })}
                          className="w-full bg-transparent font-bold tracking-tight uppercase leading-tight outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                          style={{
                            fontFamily: headingFont,
                            fontSize: `${16 * fontScale}px`,
                            color: cardText,
                          }}
                        />
                      </div>

                      {pkg.imageUrl && (
                        <div className="h-16 w-full overflow-hidden rounded-lg shrink-0">
                          <img
                            src={resolveAssetUrl(pkg.imageUrl)}
                            alt={pkg.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="pb-2 border-b border-purple-200/40 shrink-0">
                        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                          {hasPrice && (
                            <input
                              type="text"
                              value={pkg.currency}
                              onPointerDown={(ev) => {
                                ev.stopPropagation();
                                onSelectElement?.(el.id);
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                              onDoubleClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => onInlineUpdatePackage({ ...pkg, currency: ev.target.value })}
                              className="w-11 bg-transparent font-extrabold tracking-tight leading-tight outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs px-0.5 cursor-text"
                              style={{
                                fontFamily: headingFont,
                                fontSize: `${22 * fontScale}px`,
                                color: accentColor,
                              }}
                            />
                          )}
                          <input
                            type="text"
                            placeholder="A consultar"
                            value={pkg.price || ''}
                            onPointerDown={(ev) => {
                              ev.stopPropagation();
                              onSelectElement?.(el.id);
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                            onDoubleClick={(ev) => ev.stopPropagation()}
                            onChange={(ev) => onInlineUpdatePackage({ ...pkg, price: ev.target.value })}
                            className="min-w-[100px] max-w-[165px] flex-1 bg-transparent tabular-nums font-extrabold tracking-tight leading-tight outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 placeholder:opacity-100 cursor-text"
                            style={{
                              fontFamily: headingFont,
                              fontSize: `${(hasPrice ? 28 : 22) * fontScale}px`,
                              color: accentColor,
                            }}
                          />
                          <div className="inline-flex items-baseline gap-0.5 text-[11px] opacity-70 font-medium">
                            <span>/</span>
                            <input
                              type="text"
                              placeholder="Pago único"
                              value={pkg.billingPeriod || ''}
                              onPointerDown={(ev) => {
                                ev.stopPropagation();
                                onSelectElement?.(el.id);
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                              onDoubleClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => onInlineUpdatePackage({ ...pkg, billingPeriod: ev.target.value })}
                              className="w-24 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                              style={{ color: cardText }}
                            />
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Descripción breve del plan..."
                          value={pkg.description || ''}
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            onSelectElement?.(el.id);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => onInlineUpdatePackage({ ...pkg, description: ev.target.value })}
                          className="w-full bg-transparent text-[10.5px] leading-snug uppercase tracking-wide opacity-80 mt-1 font-medium resize-none outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                          style={{ color: cardText }}
                        />
                      </div>

                      <ul className="space-y-1 pt-0.5 flex-1 min-h-0 overflow-y-auto pr-1">
                        {(pkg.features || []).slice(0, 8).map((feat, idx) => (
                          <li key={idx} className="group/feat flex items-start gap-1.5 text-[11.5px] leading-snug">
                            <CheckCircle2
                              className="w-3.5 h-3.5 mt-0.5 shrink-0"
                              style={{ color: identity.secondaryColor }}
                            />
                            <input
                              type="text"
                              value={feat}
                              onPointerDown={(ev) => {
                                ev.stopPropagation();
                                onSelectElement?.(el.id);
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                              onDoubleClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => {
                                const nextFeats = [...(pkg.features || [])];
                                nextFeats[idx] = ev.target.value;
                                onInlineUpdatePackage({ ...pkg, features: nextFeats });
                              }}
                              className="flex-1 min-w-0 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                              style={{ color: cardText }}
                            />
                            <button
                              type="button"
                              title="Quitar punto"
                              onPointerDown={(ev) => ev.stopPropagation()}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                const nextFeats = (pkg.features || []).filter((_, i) => i !== idx);
                                onInlineUpdatePackage({ ...pkg, features: nextFeats }, true);
                              }}
                              className="opacity-0 group-hover/feat:opacity-100 p-0.5 text-red-500 hover:bg-red-500/10 rounded cursor-pointer shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                        <li>
                          <button
                            type="button"
                            onPointerDown={(ev) => {
                              ev.stopPropagation();
                              onSelectElement?.(el.id);
                            }}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onInlineUpdatePackage(
                                { ...pkg, features: [...(pkg.features || []), 'Nuevo beneficio incluido'] },
                                true
                              );
                            }}
                            className="inline-flex items-center gap-1 text-[10.5px] font-semibold opacity-65 hover:opacity-100 px-1.5 py-0.5 rounded hover:bg-amber-500/15 cursor-pointer"
                            style={{ color: accentColor }}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Agregar punto</span>
                          </button>
                        </li>
                      </ul>
                    </div>

                    <div
                      className="mt-3 shrink-0 w-full py-1.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 text-white"
                      style={{
                        backgroundColor: pkg.isPopular ? accentColor : identity.primaryColor,
                        borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                      }}
                    >
                      <input
                        type="text"
                        value={el.content !== undefined ? el.content : 'Solicitar plan'}
                        placeholder="Solicitar plan"
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          onSelectElement?.(el.id);
                        }}
                        onClick={(ev) => ev.stopPropagation()}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => onUpdateElement?.(el.id, { content: ev.target.value }, true)}
                        className="w-32 text-center bg-transparent text-white font-semibold outline-none focus:ring-1 focus:ring-white/70 rounded cursor-text"
                      />
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 flex flex-col gap-2">
                      {pkg.isPopular && (
                        <div
                          className="self-start inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-white tracking-wide shrink-0"
                          style={{ backgroundColor: accentColor }}
                        >
                          {pkg.promoLabel || 'Más Popular'}
                        </div>
                      )}
                      {!pkg.isPopular && pkg.promoLabel && (
                        <div
                          className="text-[10.5px] font-bold uppercase tracking-wider shrink-0"
                          style={{ color: accentColor }}
                        >
                          {pkg.promoLabel}
                        </div>
                      )}

                      <div className="shrink-0">
                        <h3
                          className="font-bold tracking-tight uppercase leading-tight break-words"
                          style={{
                            fontFamily: headingFont,
                            fontSize: `${16 * fontScale}px`,
                            color: cardText,
                          }}
                        >
                          {pkg.name}
                        </h3>
                      </div>

                      {pkg.imageUrl && (
                        <div className="h-16 w-full overflow-hidden rounded-lg shrink-0">
                          <img
                            src={resolveAssetUrl(pkg.imageUrl)}
                            alt={pkg.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="pb-2 border-b border-purple-200/40 shrink-0">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <span
                            className="tabular-nums font-extrabold tracking-tight leading-tight"
                            style={{
                              fontFamily: headingFont,
                              fontSize: `${(hasPrice ? 30 : 22) * fontScale}px`,
                              color: accentColor,
                            }}
                          >
                            {hasPrice
                              ? isShortCurrency
                                ? `$${pkg.price}`
                                : `${pkg.currency} ${pkg.price}`
                              : 'A consultar'}
                          </span>
                          {pkg.billingPeriod && (
                            <span className="text-[11px] opacity-65 font-medium whitespace-nowrap">
                              / {pkg.billingPeriod}
                            </span>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-[10.5px] leading-snug uppercase tracking-wide opacity-75 mt-1 font-medium line-clamp-2">
                            {pkg.description}
                          </p>
                        )}
                      </div>

                      <ul className="space-y-1.5 pt-0.5 flex-1 min-h-0 overflow-y-auto pr-1">
                        {(pkg.features || []).slice(0, 6).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                            <CheckCircle2
                              className="w-3.5 h-3.5 mt-0.5 shrink-0"
                              style={{ color: identity.secondaryColor }}
                            />
                            <span className="break-words">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <a
                      href={editMode ? undefined : whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(ev) => {
                        if (editMode || whatsappHref === '#') ev.preventDefault();
                        if (!editMode && whatsappHref === '#') onGotoContact?.();
                      }}
                      className="mt-3 shrink-0 w-full py-2 px-3.5 text-xs font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 text-white"
                      style={{
                        backgroundColor: pkg.isPopular ? accentColor : identity.primaryColor,
                        borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                      }}
                    >
                      <span>{ctaLabel}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (el.type === 'testimonials-grid') {
      const visibleTestimonials = testimonials.filter((t) => t.visible).slice(0, 4);
      const cardBg = s.backgroundColor || identity.surfaceColor;
      const cardText = s.color || identity.textColor;
      if (visibleTestimonials.length === 0) {
        return (
          <div
            onDoubleClick={(ev) => {
              if (editMode && !panMode && onQuickEditDynamic) {
                ev.stopPropagation();
                onQuickEditDynamic(el);
              }
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed text-center text-sm"
            style={{
              backgroundColor: cardBg,
              color: cardText,
              borderColor: 'rgba(109,40,217,0.28)',
              borderRadius: `${radius}px`,
              fontFamily: bodyFont,
            }}
          >
            <span>
              {editMode
                ? 'No hay testimonios visibles. Haz clic para crear o editar testimonios.'
                : 'Testimonios disponibles próximamente.'}
            </span>
            {editMode && !panMode && onQuickEditDynamic && (
              <button
                type="button"
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onQuickEditDynamic(el);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar testimonios</span>
              </button>
            )}
          </div>
        );
      }
      return (
        <div
          className="w-full h-full grid gap-5"
          style={{
            gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, visibleTestimonials.length))}, minmax(0, 1fr))`,
            fontFamily: bodyFont,
          }}
        >
          {visibleTestimonials.map((item) => (
            <div
              key={item.id}
              onDoubleClick={(ev) => {
                if (editMode && !panMode && onQuickEditDynamic) {
                  ev.stopPropagation();
                  onQuickEditDynamic(el, item.id);
                }
              }}
              className="group/card relative flex flex-col justify-between p-5 border min-h-0 overflow-hidden"
              style={{
                backgroundColor: cardBg,
                color: cardText,
                borderColor: s.borderColor || 'rgba(20,20,19,0.08)',
                borderRadius: `${radius}px`,
              }}
            >
              {editMode && !panMode && onQuickEditDynamic && (
                <button
                  type="button"
                  title={`Editar testimonio: ${item.clientName}`}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onQuickEditDynamic(el, item.id);
                  }}
                  className={`absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-950/85 hover:bg-amber-600 text-white text-[10px] font-semibold shadow transition-opacity cursor-pointer ${
                    selectedElementId === el.id ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
                  }`}
                >
                  <Pencil className="w-2.5 h-2.5" />
                  <span>Editar</span>
                </button>
              )}
              {editMode && !panMode && onInlineUpdateTestimonial ? (
                <>
                  <div className="space-y-2 flex-1 min-h-0 flex flex-col pr-1">
                    <input
                      type="text"
                      placeholder="MÉTRICA / RESULTADO"
                      value={item.resultMetric || ''}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        onSelectElement?.(el.id);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onInlineUpdateTestimonial({ ...item, resultMetric: ev.target.value })}
                      className="w-full pr-14 bg-transparent text-[11px] font-semibold uppercase tracking-widest outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                      style={{ color: accentColor }}
                    />
                    <textarea
                      rows={4}
                      value={item.quote}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        onSelectElement?.(el.id);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onInlineUpdateTestimonial({ ...item, quote: ev.target.value })}
                      className="w-full flex-1 bg-transparent leading-snug resize-none outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                      style={{
                        fontFamily: headingFont,
                        fontSize: `${16 * fontScale}px`,
                        color: cardText,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-3 mt-2 border-t shrink-0" style={{ borderColor: 'rgba(20,20,19,0.08)' }}>
                    {item.avatarUrl ? (
                      <img
                        src={resolveAssetUrl(item.avatarUrl)}
                        alt={item.clientName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: bgColor, color: cardText }}
                      >
                        {item.clientName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <input
                        type="text"
                        value={item.clientName}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          onSelectElement?.(el.id);
                        }}
                        onClick={(ev) => ev.stopPropagation()}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => onInlineUpdateTestimonial({ ...item, clientName: ev.target.value })}
                        className="w-full bg-transparent text-sm font-semibold outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 focus:bg-amber-500/10 rounded-xs px-0.5 cursor-text"
                        style={{ color: cardText }}
                      />
                      <div className="flex items-center gap-1 text-xs opacity-75">
                        <input
                          type="text"
                          placeholder="Cargo"
                          value={item.clientRole || ''}
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            onSelectElement?.(el.id);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => onInlineUpdateTestimonial({ ...item, clientRole: ev.target.value })}
                          className="w-1/2 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs px-0.5 cursor-text"
                          style={{ color: cardText }}
                        />
                        <span>·</span>
                        <input
                          type="text"
                          placeholder="Empresa"
                          value={item.company || ''}
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            onSelectElement?.(el.id);
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => onInlineUpdateTestimonial({ ...item, company: ev.target.value })}
                          className="w-1/2 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs px-0.5 cursor-text"
                          style={{ color: cardText }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                    {item.resultMetric && (
                      <p
                        className="text-[11px] font-semibold uppercase tracking-widest"
                        style={{ color: accentColor }}
                      >
                        {item.resultMetric}
                      </p>
                    )}
                    <p
                      className="leading-snug break-words"
                      style={{
                        fontFamily: headingFont,
                        fontSize: `${17 * fontScale}px`,
                        color: cardText,
                      }}
                    >
                      “{item.quote}”
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-3 mt-2 border-t shrink-0" style={{ borderColor: 'rgba(20,20,19,0.08)' }}>
                    {item.avatarUrl ? (
                      <img
                        src={resolveAssetUrl(item.avatarUrl)}
                        alt={item.clientName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: bgColor, color: cardText }}
                      >
                        {item.clientName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: cardText }}>
                        {item.clientName}
                      </div>
                      <div className="text-xs truncate opacity-70">
                        {[item.clientRole, item.company].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (el.type === 'gallery') {
      const items = el.galleryItems || [];
      const categories = ['Todos', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))];
      const shown = galleryFilter === 'Todos' ? items : items.filter((i) => i.category === galleryFilter);
      const cols = el.galleryColumns || 3;
      const isLogoContainMode = s.objectFit === 'contain';
      const isCleanPhotoGrid = s.shadow === 'none' && !isLogoContainMode;

      return (
        <div className="w-full h-full flex flex-col gap-3" style={{ fontFamily: bodyFont }}>
          {categories.length > 2 && !editMode && !isLogoContainMode && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setGalleryFilter(cat);
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer"
                  style={{
                    backgroundColor: galleryFilter === cat ? identity.primaryColor : 'rgba(109,40,217,0.08)',
                    color: galleryFilter === cat ? '#FFFFFF' : identity.textColor,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div
            className={`flex-1 grid min-h-0 ${isLogoContainMode ? 'gap-3' : isCleanPhotoGrid ? 'gap-2.5' : 'gap-4'}`}
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
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
              const brokenKey = `${item.id}:${itemUrl}`;
              const hasValidUrl = Boolean(itemUrl) && !brokenImages[brokenKey];

              const itemPopupAllowed = item.enablePopup !== false;

              if (isLogoContainMode) {
                const canOpenLogoPopup = !editMode && hasValidUrl && itemPopupAllowed;
                return (
                  <div
                    key={item.id}
                    onClick={(ev) => {
                      if (!canOpenLogoPopup) return;
                      ev.stopPropagation();
                      onOpenLightbox?.({ ...item, url: itemUrl });
                    }}
                    className={`relative group overflow-hidden border flex flex-col items-center justify-center p-2.5 min-h-0 ${
                      canOpenLogoPopup ? 'cursor-zoom-in' : ''
                    }`}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: 'rgba(109,40,217,0.1)',
                      borderRadius: `${radius}px`,
                    }}
                  >
                    {hasValidUrl ? (
                      <>
                        <img
                          src={itemUrl}
                          alt={item.title}
                          draggable={false}
                          onDragStart={(ev) => ev.preventDefault()}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [brokenKey]: true }))}
                          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.04]"
                        />
                        {canOpenLogoPopup && (
                          <div className="absolute bottom-1.5 right-1.5 bg-purple-950/75 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <Expand className="w-3 h-3" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center px-1.5">
                        <span
                          className="font-bold tracking-tight leading-tight line-clamp-2"
                          style={{
                            fontFamily: headingFont,
                            fontSize: `${13 * fontScale}px`,
                            color: '#3B0764',
                          }}
                        >
                          {item.title}
                        </span>
                        {item.category && (
                          <span className="text-[9px] uppercase tracking-wider text-purple-500 mt-0.5 truncate max-w-full">
                            {item.category}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              const shouldDirectVideoLink =
                !editMode &&
                isVideoItem &&
                videoTarget &&
                !videoTarget.isEmpty &&
                (videoTarget.isDownload ||
                  item.videoAction === 'external' ||
                  parsedItemVideo?.kind === 'external' ||
                  !onOpenLightbox);
              const canOpenModal =
                (isVideoItem && Boolean(videoTarget && !videoTarget.isEmpty)) ||
                (hasValidUrl && !isVideoItem && itemPopupAllowed);

              const cardInner = hasValidUrl ? (
                <>
                  <img
                    src={itemUrl}
                    alt={item.title}
                    draggable={false}
                    onDragStart={(ev) => ev.preventDefault()}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [brokenKey]: true }))}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity ${
                      isCleanPhotoGrid ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                    }`}
                  />
                  <div
                    className={`relative z-10 p-3 text-white transition-opacity ${
                      isCleanPhotoGrid ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                    }`}
                  >
                    {(isVideoItem && videoTarget && !videoTarget.isEmpty
                      ? videoTarget.actionLabel || [item.category, item.year].filter(Boolean).join(' · ')
                      : [item.category, item.year].filter(Boolean).join(' · ')) && (
                      <div className="text-[10px] uppercase tracking-wider text-purple-200 font-medium">
                        {isVideoItem && videoTarget && !videoTarget.isEmpty
                          ? videoTarget.actionLabel || [item.category, item.year].filter(Boolean).join(' · ')
                          : [item.category, item.year].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div className="text-xs font-semibold leading-snug truncate">{item.title}</div>
                  </div>
                  {(isVideoItem || itemPopupAllowed) && (
                    <div
                      className={`absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-lg transition-opacity ${
                        isVideoItem && videoTarget && !videoTarget.isEmpty
                          ? 'opacity-90 group-hover:opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isVideoItem ? (
                        videoTarget?.isDownload ? (
                          <Download className="w-3.5 h-3.5" />
                        ) : (
                          <VideoIcon className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <Expand className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className={`w-full h-full flex flex-col items-center justify-center p-2.5 text-center gap-1 ${
                    isDarkSlide ? 'text-purple-100' : 'text-purple-900'
                  }`}
                >
                  {isVideoItem ? (
                    videoTarget?.isDownload ? (
                      <Download className="w-5 h-5 opacity-70" />
                    ) : (
                      <Play className="w-5 h-5 opacity-70" />
                    )
                  ) : (
                    <ImageIcon className="w-5 h-5 opacity-45" />
                  )}
                  <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                    {item.title}
                  </span>
                  {(isVideoItem && videoTarget && !videoTarget.isEmpty
                    ? videoTarget.actionLabel || item.category
                    : item.category) && (
                    <span className="text-[9px] opacity-75 truncate max-w-full">
                      {isVideoItem && videoTarget && !videoTarget.isEmpty
                        ? videoTarget.actionLabel || item.category
                        : item.category}
                    </span>
                  )}
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
                    onClick={(ev) => ev.stopPropagation()}
                    className="relative group overflow-hidden border flex flex-col justify-end min-h-0 cursor-pointer"
                    style={{
                      backgroundColor: isDarkSlide ? 'rgba(255,255,255,0.12)' : identity.surfaceColor,
                      borderColor: isDarkSlide ? 'rgba(255,255,255,0.18)' : 'rgba(109,40,217,0.12)',
                      borderRadius: `${radius}px`,
                    }}
                  >
                    {cardInner}
                  </a>
                );
              }

              return (
                <div
                  key={item.id}
                  onClick={(ev) => {
                    if (editMode || !canOpenModal) return;
                    ev.stopPropagation();
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
                  className={`relative group overflow-hidden border flex flex-col justify-end min-h-0 ${
                    !editMode && canOpenModal ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    backgroundColor: isDarkSlide ? 'rgba(255,255,255,0.12)' : identity.surfaceColor,
                    borderColor: isDarkSlide ? 'rgba(255,255,255,0.18)' : 'rgba(109,40,217,0.12)',
                    borderRadius: `${radius}px`,
                  }}
                >
                  {cardInner}
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
      const cardBg = s.backgroundColor || identity.surfaceColor;
      const cardText = s.color || identity.textColor;
      const channels = [
        { label: 'Instagram', url: contact.instagramUrl, icon: Instagram },
        { label: 'Facebook', url: contact.facebookUrl, icon: Facebook },
        { label: 'TikTok', url: contact.tiktokUrl, icon: Globe },
        { label: 'Sitio Web', url: contact.websiteUrl, icon: Globe },
      ].filter((c) => Boolean(c.url));

      return (
        <div
          onDoubleClick={(ev) => {
            if (editMode && !panMode && onQuickEditDynamic) {
              ev.stopPropagation();
              onQuickEditDynamic(el);
            }
          }}
          className="group/card relative w-full h-full flex flex-col justify-between p-6 border overflow-hidden"
          style={{
            backgroundColor: cardBg,
            color: cardText,
            borderColor: s.borderColor || 'rgba(20,20,19,0.1)',
            borderRadius: `${radius}px`,
            fontFamily: bodyFont,
          }}
        >
          {editMode && !panMode && onQuickEditDynamic && (
            <button
              type="button"
              title="Editar datos de contacto"
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                onQuickEditDynamic(el);
              }}
              className={`absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-950/90 hover:bg-amber-600 text-white text-[11px] font-semibold shadow-md transition-opacity cursor-pointer ${
                selectedElementId === el.id ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
              }`}
            >
              <Pencil className="w-3 h-3" />
              <span>Editar contacto</span>
            </button>
          )}
          {editMode && !panMode && onInlineUpdateContact ? (
            <>
              <div className="grid grid-cols-2 gap-4 pr-28">
                <div
                  className="flex items-center gap-2 py-2.5 px-4 text-sm font-semibold min-w-0"
                  style={{
                    backgroundColor: identity.primaryColor,
                    color: '#FFFFFF',
                    borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                  }}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <input
                    type="text"
                    placeholder="Número WhatsApp (ej. 58412...)"
                    value={contact.whatsappNumber}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onSelectElement?.(el.id);
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                    onDoubleClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => onInlineUpdateContact({ whatsappNumber: ev.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-white placeholder:text-white/70 outline-none focus:ring-1 focus:ring-white/70 rounded px-1 cursor-text"
                  />
                </div>

                <div
                  className="flex items-center gap-2 py-2.5 px-4 text-sm font-semibold border min-w-0"
                  style={{
                    borderColor: 'rgba(20,20,19,0.2)',
                    color: cardText,
                    borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                  }}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={contact.email}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onSelectElement?.(el.id);
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                    onDoubleClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => onInlineUpdateContact({ email: ev.target.value })}
                    className="flex-1 min-w-0 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded px-1 cursor-text"
                    style={{ color: cardText }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'rgba(20,20,19,0.08)' }}>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <input
                    type="text"
                    placeholder="Nombre profesional / Estudio"
                    value={contact.professionalName || contact.studioName}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onSelectElement?.(el.id);
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                    onDoubleClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => onInlineUpdateContact({ professionalName: ev.target.value })}
                    className="w-full max-w-md bg-transparent text-sm font-semibold outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs px-0.5 cursor-text"
                    style={{ color: cardText }}
                  />
                  <div className="flex items-center gap-1.5 text-xs opacity-75">
                    <input
                      type="text"
                      placeholder="Especialidad"
                      value={contact.specialty}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        onSelectElement?.(el.id);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onInlineUpdateContact({ specialty: ev.target.value })}
                      className="w-56 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs px-0.5 cursor-text"
                      style={{ color: cardText }}
                    />
                    <span>·</span>
                    <input
                      type="text"
                      placeholder="Ubicación"
                      value={contact.location}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        onSelectElement?.(el.id);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => onInlineUpdateContact({ location: ev.target.value })}
                      className="w-48 bg-transparent outline-none hover:outline-1 hover:outline-dashed hover:outline-amber-500/70 focus:outline-2 focus:outline-amber-500 rounded-xs px-0.5 cursor-text"
                      style={{ color: cardText }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {channels.length > 0 ? (
                    channels.map((ch) => {
                      const Icon = ch.icon;
                      return (
                        <span
                          key={ch.label}
                          className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                          style={{ color: cardText }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{ch.label}</span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs opacity-65">
                      Edita tus redes en «Editar contacto»
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <a
                  href={editMode || !hasWa ? undefined : waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(ev) => {
                    if (editMode || !hasWa) ev.preventDefault();
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 text-sm font-semibold transition-opacity hover:opacity-90 min-w-0"
                  style={{
                    backgroundColor: identity.primaryColor,
                    color: '#FFFFFF',
                    borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                  }}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{hasWa ? 'Escribir por WhatsApp' : 'Configurar WhatsApp'}</span>
                </a>

                <a
                  href={editMode || !contact.email ? undefined : `mailto:${contact.email}`}
                  onClick={(ev) => {
                    if (editMode || !contact.email) ev.preventDefault();
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 text-sm font-semibold border transition-colors hover:opacity-80 min-w-0"
                  style={{
                    borderColor: 'rgba(20,20,19,0.2)',
                    color: cardText,
                    borderRadius: identity.buttonStyle === 'pill' ? '999px' : '8px',
                  }}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{contact.email || 'Configurar correo'}</span>
                </a>
              </div>

              <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'rgba(20,20,19,0.08)' }}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: cardText }}>
                    {contact.professionalName || contact.studioName}
                  </div>
                  <div className="text-xs truncate opacity-75">
                    {[contact.specialty, contact.location].filter(Boolean).join(' · ')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {channels.length > 0 ? (
                    channels.map((ch) => {
                      const Icon = ch.icon;
                      return (
                        <a
                          key={ch.label}
                          href={editMode ? undefined : ch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(ev) => {
                            if (editMode) ev.preventDefault();
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline whitespace-nowrap"
                          style={{ color: cardText }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{ch.label}</span>
                        </a>
                      );
                    })
                  ) : (
                    <span className="text-xs opacity-65">
                      Redes configurables en el panel derecho
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    return null;
  };

  const handles: Array<{ dir: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'; cls: string }> = [
    { dir: 'nw', cls: '-top-1.5 -left-1.5 cursor-nwse-resize' },
    { dir: 'ne', cls: '-top-1.5 -right-1.5 cursor-nesw-resize' },
    { dir: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
    { dir: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
    { dir: 'n', cls: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { dir: 's', cls: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { dir: 'w', cls: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
    { dir: 'e', cls: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
  ];

  const uiScale = scale > 0 ? Math.max(0.42, Math.min(1.5, 1 / scale)) : 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video overflow-hidden select-none flex items-center justify-center"
      style={{
        width: fixedWidth ? `${fixedWidth}px` : '100%',
        height: fixedWidth ? `${(fixedWidth * 9) / 16}px` : undefined,
        backgroundColor: bgColor,
        background: bgGradient || bgColor,
        color: identity.textColor,
      }}
      onPointerDown={() => {
        if (editMode && !panMode) {
          onSelectElement?.(null);
          setEditingTextId(null);
        }
      }}
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          width: `${CANVAS_W * scale}px`,
          height: `${CANVAS_H * scale}px`,
        }}
      >
        <div
          style={{
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'relative',
            backgroundColor: bgColor,
            background: bgGradient || bgColor,
          }}
        >
          {renderDecorativeBackground()}

        {/* Snap alignment guides in Editor */}
        {editMode && guides.vCenter && (
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-amber-500 z-50 pointer-events-none" />
        )}
        {editMode && guides.hCenter && (
          <div className="absolute left-0 right-0 top-1/2 h-px bg-amber-500 z-50 pointer-events-none" />
        )}

        {sortedElements.map((el) => {
          const isSelected = editMode && selectedElementId === el.id;
          return (
            <div
              key={el.id}
              onPointerDown={(ev) => startDrag(ev, el)}
              style={{
                position: 'absolute',
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.w}px`,
                height: `${el.h}px`,
                zIndex: el.zIndex || 1,
                opacity: el.style?.opacity ?? 1,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              }}
              className={
                editMode
                  ? `group/el touch-none ${
                      panMode ? 'pointer-events-none' : el.locked ? 'cursor-not-allowed' : 'cursor-move'
                    } ${
                      isSelected
                        ? 'ring-2 ring-amber-500 ring-offset-1'
                        : 'hover:ring-1 hover:ring-amber-400/60'
                    }`
                  : ''
              }
            >
              {renderElementContent(el)}

              {activeHud && activeHud.id === el.id && (
                <div
                  className="absolute -top-7 left-0 bg-stone-900/95 text-amber-300 border border-amber-500/40 text-[11px] font-mono tabular-nums px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-50"
                  style={{ transform: `scale(${uiScale})`, transformOrigin: 'bottom left' }}
                >
                  {activeHud.text}
                </div>
              )}

              {isSelected && el.locked && (
                <div
                  className="absolute -top-6 right-0 bg-stone-900 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{ transform: `scale(${uiScale})`, transformOrigin: 'bottom right' }}
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>Bloqueado</span>
                </div>
              )}

              {isSelected && !el.locked && !panMode && !activeHud && (onQuickUploadElement || onQuickPickMedia || onQuickEditDynamic || onSplitDynamicBlock || onDuplicateElement || onDeleteElement) && (
                <div
                  onPointerDown={(ev) => ev.stopPropagation()}
                  className={`absolute left-0 z-50 flex items-center gap-1 bg-stone-950/95 border border-white/20 rounded-md px-1 py-0.5 shadow-xl whitespace-nowrap ${
                    el.y < 38 ? '-bottom-8' : '-top-8'
                  }`}
                  style={{
                    transform: `scale(${uiScale})`,
                    transformOrigin: el.y < 38 ? 'top left' : 'bottom left',
                  }}
                >
                  {(el.type === 'packages-grid' ||
                    el.type === 'services-grid' ||
                    el.type === 'testimonials-grid' ||
                    el.type === 'contact-block') &&
                    onQuickEditDynamic && (
                      <button
                        type="button"
                        title="Abrir editor de contenido"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onQuickEditDynamic(el);
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>
                          {el.type === 'packages-grid'
                            ? 'Editar planes'
                            : el.type === 'services-grid'
                            ? 'Editar servicios'
                            : el.type === 'testimonials-grid'
                            ? 'Editar testimonios'
                            : 'Editar contacto'}
                        </span>
                      </button>
                    )}
                  {(el.type === 'packages-grid' ||
                    el.type === 'services-grid' ||
                    el.type === 'testimonials-grid' ||
                    el.type === 'contact-block') &&
                    onSplitDynamicBlock && (
                      <button
                        type="button"
                        title="Desagrupar en tarjetas, textos y botones independientes para mover, redimensionar o eliminar cada uno"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSplitDynamicBlock(el);
                        }}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                      >
                        <Ungroup className="w-3 h-3" />
                        <span>Separar</span>
                      </button>
                    )}
                  {(el.type === 'image' || el.type === 'video') && onQuickUploadElement && (
                    <button
                      type="button"
                      title={el.type === 'video' ? 'Subir imagen de portada' : 'Subir foto o logo'}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onQuickUploadElement(el);
                      }}
                      className="p-1 text-amber-300 hover:text-white hover:bg-white/10 rounded cursor-pointer flex items-center gap-1 text-[10px] font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{el.type === 'video' ? 'Portada' : 'Subir'}</span>
                    </button>
                  )}
                  {(el.type === 'image' || el.type === 'video') && onQuickPickMedia && (
                    <button
                      type="button"
                      title="Elegir de Biblioteca"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onQuickPickMedia(el);
                      }}
                      className="p-1 text-stone-200 hover:text-white hover:bg-white/10 rounded cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3" />
                    </button>
                  )}
                  {el.type === 'image' && onUpdateElement && (
                    <button
                      type="button"
                      title={
                        el.enablePopup !== false
                          ? 'Popup activado al hacer clic (clic para desactivar)'
                          : 'Popup desactivado (clic para activar)'
                      }
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onUpdateElement(el.id, { enablePopup: el.enablePopup === false }, true);
                      }}
                      className={`px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 text-[10px] font-medium ${
                        el.enablePopup !== false
                          ? 'text-emerald-300 hover:bg-emerald-500/20'
                          : 'text-stone-400 hover:bg-white/10 line-through'
                      }`}
                    >
                      <Expand className="w-2.5 h-2.5" />
                      <span>{el.enablePopup !== false ? 'Popup' : 'Sin popup'}</span>
                    </button>
                  )}
                  {onDuplicateElement && (
                    <button
                      type="button"
                      title="Duplicar"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDuplicateElement(el);
                      }}
                      className="p-1 text-stone-200 hover:text-white hover:bg-white/10 rounded cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  {onDeleteElement && (
                    <button
                      type="button"
                      title="Eliminar elemento"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDeleteElement(el.id);
                      }}
                      className="p-1 text-red-300 hover:text-red-100 hover:bg-red-600/40 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {isSelected && !el.locked && !panMode && (
                <>
                  {handles.map((h) => (
                    <div
                      key={h.dir}
                      onPointerDown={(ev) => startResize(ev, el, h.dir)}
                      className={`absolute w-4 h-4 flex items-center justify-center z-50 touch-none ${h.cls}`}
                    >
                      <span
                        className="block w-3 h-3 bg-white border-2 border-amber-600 rounded-xs shadow-sm"
                        style={{ transform: `scale(${uiScale})` }}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};
