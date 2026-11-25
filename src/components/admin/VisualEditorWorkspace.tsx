import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  ArrowUpToLine,
  Briefcase,
  Check,
  Copy,
  CreditCard,
  Crosshair,
  Download,
  Expand,
  ExternalLink,
  Eye,
  EyeOff,
  Grid,
  Hand,
  Image as ImageIcon,
  Layers,
  Link2,
  Lock,
  Mail,
  Maximize2,
  MessageSquareQuote,
  Minus,
  MousePointerClick,
  Pencil,
  Plus,
  Proportions,
  Redo2,
  RotateCcw,
  Save,
  ScanSearch,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DEFAULT_PAGES, FONT_OPTIONS } from '../../data/defaultPortfolio';
import {
  deleteDraftPackage,
  deleteDraftPage,
  deleteDraftService,
  deleteDraftTestimonial,
  saveDraftConfig,
  saveDraftPackage,
  saveDraftPage,
  saveDraftService,
  saveDraftTestimonial,
} from '../../services/portfolioService';
import { uploadMediaFile } from '../../services/storageService';
import type {
  CanvasElement,
  ContactConfig,
  ElementType,
  GalleryMediaItem,
  MediaFolder,
  MediaItem,
  PackageItem,
  PortfolioConfig,
  PortfolioPage,
  ServiceItem,
  TestimonialItem,
} from '../../types/portfolio';
import { SlideRenderer } from '../canvas/SlideRenderer';
import { MediaLightboxModal } from '../public/MediaLightboxModal';
import { resolveAssetUrl } from '../../utils/assetUrl';
import {
  extractGoogleDriveId,
  isLikelyVideoUrl,
  resolveVideoClickTarget,
  type VideoClickMode,
} from '../../utils/videoEmbed';
import { splitDynamicBlockToElements } from '../../utils/splitDynamicBlock';
import { MediaLibraryView } from './MediaLibraryView';

interface VisualEditorWorkspaceProps {
  user: User;
  config: PortfolioConfig;
  pages: PortfolioPage[];
  services: ServiceItem[];
  packages: PackageItem[];
  testimonials: TestimonialItem[];
  mediaFolders: MediaFolder[];
  mediaItems: MediaItem[];
  initialPageId?: string;
  onPublishClick: () => void;
}

export const VisualEditorWorkspace: React.FC<VisualEditorWorkspaceProps> = ({
  user,
  config,
  pages,
  services,
  packages,
  testimonials,
  mediaFolders,
  mediaItems,
  initialPageId,
  onPublishClick,
}) => {
  const [activePageId, setActivePageId] = useState<string>(initialPageId || pages[0]?.id || '');
  const [localPage, setLocalPage] = useState<PortfolioPage | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'layers' | 'pages'>('layers');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [fitScalePct, setFitScalePct] = useState(80);
  const [handTool, setHandTool] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLightboxItem, setPreviewLightboxItem] = useState<GalleryMediaItem | null>(null);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    | null
    | { mode: 'element-image' }
    | { mode: 'element-video' }
    | { mode: 'element-poster' }
    | { mode: 'page-bg' }
    | { mode: 'gallery-item'; itemId: string }
    | { mode: 'gallery-add' }
    | { mode: 'package-image'; packageId: string }
    | { mode: 'testimonial-avatar'; testimonialId: string }
  >(null);

  const [history, setHistory] = useState<PortfolioPage[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [directUploading, setDirectUploading] = useState(false);
  const [directUploadPct, setDirectUploadPct] = useState(0);
  const [directUploadError, setDirectUploadError] = useState<string | null>(null);
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PortfolioPage | null>(null);
  const [alsoDeletePublished, setAlsoDeletePublished] = useState(true);
  const [deletingPage, setDeletingPage] = useState(false);
  const [showGalleryLinkInput, setShowGalleryLinkInput] = useState(false);
  const [galleryLinkUrl, setGalleryLinkUrl] = useState('');
  const [galleryLinkPosterUrl, setGalleryLinkPosterUrl] = useState('');
  const [galleryLinkTitle, setGalleryLinkTitle] = useState('');
  const [galleryLinkVideoAction, setGalleryLinkVideoAction] = useState<VideoClickMode>('online');

  // Local live-editable collections for dynamic blocks (Packages, Services, Testimonials, Contact)
  const [localPackages, setLocalPackages] = useState<PackageItem[]>(packages);
  const [localServices, setLocalServices] = useState<ServiceItem[]>(services);
  const [localTestimonials, setLocalTestimonials] = useState<TestimonialItem[]>(testimonials);
  const [localContact, setLocalContact] = useState<ContactConfig>(config.contact);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editingPkgFeaturesText, setEditingPkgFeaturesText] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceDeliverablesText, setEditingServiceDeliverablesText] = useState('');
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [dynamicEditModal, setDynamicEditModal] = useState<
    | null
    | {
        elementId: string;
        type: 'packages-grid' | 'services-grid' | 'testimonials-grid' | 'contact-block';
        focusItemId?: string;
      }
  >(null);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pkgSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPkgDraftsRef = useRef<Map<string, PackageItem>>(new Map());
  const srvSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSrvDraftsRef = useRef<Map<string, ServiceItem>>(new Map());
  const testSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingTestDraftsRef = useRef<Map<string, TestimonialItem>>(new Map());
  const contactSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContactRef = useRef<ContactConfig | null>(null);
  const directUploadRef = useRef<HTMLInputElement>(null);
  const pendingUploadElementIdRef = useRef<string | null>(null);
  const localPageRef = useRef<PortfolioPage | null>(null);
  const historyRef = useRef<PortfolioPage[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const dirtyRef = useRef(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const pendingScrollAnchorRef = useRef<{
    u: number;
    v: number;
    vpOffsetX: number;
    vpOffsetY: number;
  } | null>(null);
  const effectiveZoomPctRef = useRef(80);

  useEffect(() => {
    setLocalPackages((prev) => {
      const prevMap = new Map(prev.map((p) => [p.id, p]));
      const next = packages.map((p) =>
        pendingPkgDraftsRef.current.has(p.id) ? pendingPkgDraftsRef.current.get(p.id)! : p
      );
      pendingPkgDraftsRef.current.forEach((draft, id) => {
        if (!next.some((x) => x.id === id)) {
          next.push(prevMap.get(id) || draft);
        }
      });
      return next.sort((a, b) => a.order - b.order);
    });
  }, [packages]);

  useEffect(() => {
    setLocalServices((prev) => {
      const prevMap = new Map(prev.map((s) => [s.id, s]));
      const next = services.map((s) =>
        pendingSrvDraftsRef.current.has(s.id) ? pendingSrvDraftsRef.current.get(s.id)! : s
      );
      pendingSrvDraftsRef.current.forEach((draft, id) => {
        if (!next.some((x) => x.id === id)) {
          next.push(prevMap.get(id) || draft);
        }
      });
      return next.sort((a, b) => a.order - b.order);
    });
  }, [services]);

  useEffect(() => {
    setLocalTestimonials((prev) => {
      const prevMap = new Map(prev.map((t) => [t.id, t]));
      const next = testimonials.map((t) =>
        pendingTestDraftsRef.current.has(t.id) ? pendingTestDraftsRef.current.get(t.id)! : t
      );
      pendingTestDraftsRef.current.forEach((draft, id) => {
        if (!next.some((x) => x.id === id)) {
          next.push(prevMap.get(id) || draft);
        }
      });
      return next.sort((a, b) => a.order - b.order);
    });
  }, [testimonials]);

  useEffect(() => {
    if (!pendingContactRef.current) {
      setLocalContact(config.contact);
    }
  }, [config.contact]);

  const lastAutoExpandedKeyRef = useRef<string | null>(null);

  // Auto-expand first package/service/testimonial once when selecting a dynamic grid in the inspector
  useEffect(() => {
    const el = localPage?.elements.find((item) => item.id === selectedElementId);
    if (!el) {
      lastAutoExpandedKeyRef.current = null;
      return;
    }
    const selKey = `${el.id}:${el.packageCategory || ''}`;
    if (lastAutoExpandedKeyRef.current === selKey) return;

    if (el.type === 'packages-grid') {
      const cat = el.packageCategory || 'branding';
      const inCat = localPackages.filter((p) => p.category === cat);
      if (inCat.length > 0) {
        lastAutoExpandedKeyRef.current = selKey;
        setEditingPkgId(inCat[0].id);
        setEditingPkgFeaturesText((inCat[0].features || []).join('\n'));
      }
    } else if (el.type === 'services-grid') {
      if (localServices.length > 0) {
        lastAutoExpandedKeyRef.current = selKey;
        setEditingServiceId(localServices[0].id);
        setEditingServiceDeliverablesText((localServices[0].deliverables || []).join('\n'));
      }
    } else if (el.type === 'testimonials-grid') {
      if (localTestimonials.length > 0) {
        lastAutoExpandedKeyRef.current = selKey;
        setEditingTestimonialId(localTestimonials[0].id);
      }
    }
  }, [selectedElementId, localPage, localPackages, localServices, localTestimonials]);

  const openDynamicEditor = (el: CanvasElement, focusItemId?: string) => {
    if (
      el.type !== 'packages-grid' &&
      el.type !== 'services-grid' &&
      el.type !== 'testimonials-grid' &&
      el.type !== 'contact-block'
    ) {
      return;
    }
    setSelectedElementId(el.id);
    if (el.type === 'packages-grid') {
      const cat = el.packageCategory || 'branding';
      const target =
        (focusItemId && localPackages.find((p) => p.id === focusItemId)) ||
        localPackages.find((p) => p.category === cat);
      if (target) {
        setEditingPkgId(target.id);
        setEditingPkgFeaturesText((target.features || []).join('\n'));
      }
    } else if (el.type === 'services-grid') {
      const target =
        (focusItemId && localServices.find((s) => s.id === focusItemId)) || localServices[0];
      if (target) {
        setEditingServiceId(target.id);
        setEditingServiceDeliverablesText((target.deliverables || []).join('\n'));
      }
    } else if (el.type === 'testimonials-grid') {
      const target =
        (focusItemId && localTestimonials.find((t) => t.id === focusItemId)) || localTestimonials[0];
      if (target) {
        setEditingTestimonialId(target.id);
      }
    }
    setDynamicEditModal({ elementId: el.id, type: el.type, focusItemId });
  };

  const persistPackageNow = async (pkg: PackageItem) => {
    const t = pkgSaveTimersRef.current.get(pkg.id);
    if (t) {
      clearTimeout(t);
      pkgSaveTimersRef.current.delete(pkg.id);
    }
    pendingPkgDraftsRef.current.delete(pkg.id);
    setSaveState('saving');
    try {
      await saveDraftPackage({ ...pkg, name: pkg.name.trim() || 'Plan sin nombre' }, user);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const updatePackageDraft = (updated: PackageItem, immediate = false) => {
    setLocalPackages((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      const list = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
      return [...list].sort((a, b) => a.order - b.order);
    });
    if (immediate) {
      void persistPackageNow(updated);
      return;
    }
    pendingPkgDraftsRef.current.set(updated.id, updated);
    const prevTimer = pkgSaveTimersRef.current.get(updated.id);
    if (prevTimer) clearTimeout(prevTimer);
    setSaveState('saving');
    pkgSaveTimersRef.current.set(
      updated.id,
      setTimeout(() => {
        void persistPackageNow(updated);
      }, 450)
    );
  };

  const persistServiceNow = async (srv: ServiceItem) => {
    const t = srvSaveTimersRef.current.get(srv.id);
    if (t) {
      clearTimeout(t);
      srvSaveTimersRef.current.delete(srv.id);
    }
    pendingSrvDraftsRef.current.delete(srv.id);
    setSaveState('saving');
    try {
      await saveDraftService({ ...srv, title: srv.title.trim() || 'Servicio sin título' }, user);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const updateServiceDraft = (updated: ServiceItem, immediate = false) => {
    setLocalServices((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      const list = exists ? prev.map((s) => (s.id === updated.id ? updated : s)) : [...prev, updated];
      return [...list].sort((a, b) => a.order - b.order);
    });
    if (immediate) {
      void persistServiceNow(updated);
      return;
    }
    pendingSrvDraftsRef.current.set(updated.id, updated);
    const prevTimer = srvSaveTimersRef.current.get(updated.id);
    if (prevTimer) clearTimeout(prevTimer);
    setSaveState('saving');
    srvSaveTimersRef.current.set(
      updated.id,
      setTimeout(() => {
        void persistServiceNow(updated);
      }, 450)
    );
  };

  const persistTestimonialNow = async (item: TestimonialItem) => {
    const t = testSaveTimersRef.current.get(item.id);
    if (t) {
      clearTimeout(t);
      testSaveTimersRef.current.delete(item.id);
    }
    pendingTestDraftsRef.current.delete(item.id);
    setSaveState('saving');
    try {
      await saveDraftTestimonial(
        {
          ...item,
          clientName: item.clientName.trim() || 'Cliente',
          quote: item.quote.trim() || 'Excelente trabajo profesional.',
        },
        user
      );
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const updateTestimonialDraft = (updated: TestimonialItem, immediate = false) => {
    setLocalTestimonials((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      const list = exists ? prev.map((t) => (t.id === updated.id ? updated : t)) : [...prev, updated];
      return [...list].sort((a, b) => a.order - b.order);
    });
    if (immediate) {
      void persistTestimonialNow(updated);
      return;
    }
    pendingTestDraftsRef.current.set(updated.id, updated);
    const prevTimer = testSaveTimersRef.current.get(updated.id);
    if (prevTimer) clearTimeout(prevTimer);
    setSaveState('saving');
    testSaveTimersRef.current.set(
      updated.id,
      setTimeout(() => {
        void persistTestimonialNow(updated);
      }, 450)
    );
  };

  const persistContactNow = async (nextContact: ContactConfig) => {
    if (contactSaveTimerRef.current) {
      clearTimeout(contactSaveTimerRef.current);
      contactSaveTimerRef.current = null;
    }
    pendingContactRef.current = null;
    setSaveState('saving');
    try {
      await saveDraftConfig({ ...config, contact: nextContact }, user);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const updateContactDraft = (patch: Partial<ContactConfig>, immediate = false) => {
    const next = { ...localContact, ...patch };
    setLocalContact(next);
    if (immediate) {
      void persistContactNow(next);
      return;
    }
    pendingContactRef.current = next;
    if (contactSaveTimerRef.current) clearTimeout(contactSaveTimerRef.current);
    setSaveState('saving');
    contactSaveTimerRef.current = setTimeout(() => {
      void persistContactNow(next);
    }, 450);
  };

  const flushDynamicSaves = async () => {
    const tasks: Array<Promise<void>> = [];
    pendingPkgDraftsRef.current.forEach((pkg) => tasks.push(persistPackageNow(pkg)));
    pendingSrvDraftsRef.current.forEach((srv) => tasks.push(persistServiceNow(srv)));
    pendingTestDraftsRef.current.forEach((t) => tasks.push(persistTestimonialNow(t)));
    if (pendingContactRef.current) tasks.push(persistContactNow(pendingContactRef.current));
    await Promise.all(tasks);
  };

  const flushAutoSave = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await flushDynamicSaves();
    if (!dirtyRef.current || !localPageRef.current) return;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      await saveDraftPage(localPageRef.current, user);
      setSaveState('saved');
    } catch {
      dirtyRef.current = true;
      setSaveState('error');
    }
  };

  const switchActivePage = (nextPageId: string) => {
    if (nextPageId === activePageId) return;
    void flushAutoSave();
    setEditingPkgId(null);
    setEditingServiceId(null);
    setEditingTestimonialId(null);
    setActivePageId(nextPageId);
  };

  const handleCreatePageInEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim() || `Página ${pages.length + 1}`;
    const id = `page_${Date.now()}`;
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || id;

    const newPage: PortfolioPage = {
      id,
      order: pages.length + 1,
      slug,
      title,
      subtitle: 'Página personalizada',
      templateType: 'custom',
      visible: true,
      elements: [
        {
          id: `el_${Date.now()}_k`,
          type: 'text',
          name: 'Etiqueta',
          x: 72,
          y: 56,
          w: 400,
          h: 24,
          zIndex: 2,
          content: title.toUpperCase(),
          style: {
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: config.visualIdentity.accentColor,
          },
        },
        {
          id: `el_${Date.now()}_h`,
          type: 'heading',
          name: 'Titular',
          x: 72,
          y: 96,
          w: 840,
          h: 80,
          zIndex: 2,
          content: 'Nuevo Titular de Página',
          style: {
            fontSize: 42,
            fontWeight: 600,
            lineHeight: 1.12,
          },
        },
        {
          id: `el_${Date.now()}_t`,
          type: 'text',
          name: 'Descripción',
          x: 72,
          y: 196,
          w: 700,
          h: 120,
          zIndex: 2,
          content: 'Agrega fotografías, videos, enlaces, tarjetas o galerías desde la barra superior.',
          style: {
            fontSize: 16,
            lineHeight: 1.6,
            color: config.visualIdentity.mutedTextColor,
          },
        },
      ],
    };

    setCreatingPage(true);
    try {
      await flushAutoSave();
      await saveDraftPage(newPage, user);
      setNewPageTitle('');
      setShowCreatePageModal(false);
      setActivePageId(id);
    } finally {
      setCreatingPage(false);
    }
  };

  const handleConfirmDeletePage = async () => {
    if (!pageToDelete || pages.length <= 1) return;
    setDeletingPage(true);
    try {
      const targetId = pageToDelete.id;
      if (targetId === activePageId) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        dirtyRef.current = false;
        const remaining = pages.filter((p) => p.id !== targetId);
        if (remaining[0]) {
          setActivePageId(remaining[0].id);
        }
      }
      await deleteDraftPage(targetId, { alsoDeletePublished });
      setPageToDelete(null);
    } finally {
      setDeletingPage(false);
    }
  };

  // Sync activePageId if pages change or initialPageId changes
  useEffect(() => {
    if (initialPageId && pages.some((p) => p.id === initialPageId)) {
      setActivePageId(initialPageId);
    } else if (!pages.some((p) => p.id === activePageId) && pages[0]) {
      setActivePageId(pages[0].id);
    }
  }, [initialPageId, pages, activePageId]);

  const splitGalleryElementToIndividual = (galleryEl: CanvasElement): CanvasElement[] => {
    const items = galleryEl.galleryItems || [];
    if (items.length === 0) return [];
    const cols = Math.max(1, galleryEl.galleryColumns || 3);
    const rows = Math.max(1, Math.ceil(items.length / cols));
    const gap = 12;
    const cellW = Math.max(48, Math.round((galleryEl.w - gap * (cols - 1)) / cols));
    const cellH = Math.max(48, Math.round((galleryEl.h - gap * (rows - 1)) / rows));
    const isLogoMode = galleryEl.style?.objectFit === 'contain';
    const isP10 = galleryEl.id === 'p10_gallery';
    const stamp = Date.now();

    return items.map((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const num = String(idx + 1).padStart(2, '0');
      const isVid = item.mediaType === 'video' || Boolean(item.videoUrl);
      return {
        id: isP10 ? `p10_logo_${num}` : `el_${stamp}_${idx}`,
        type: isVid ? ('video' as const) : ('image' as const),
        name: isLogoMode ? `Logo · ${item.title || num}` : item.title || `Imagen ${num}`,
        x: Math.round(galleryEl.x + col * (cellW + gap)),
        y: Math.round(galleryEl.y + row * (cellH + gap)),
        w: cellW,
        h: cellH,
        zIndex: galleryEl.zIndex || 3,
        content: item.title || '',
        mediaUrl: isVid ? item.videoUrl || item.url || '' : item.url || '',
        posterUrl: isVid ? item.url || '' : undefined,
        videoClickMode: isVid ? item.videoAction || 'online' : undefined,
        videoActionLabel: isVid ? item.videoActionLabel : undefined,
        enablePopup: item.enablePopup,
        style: isLogoMode
          ? {
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(109,40,217,0.12)',
              borderRadius: galleryEl.style?.borderRadius ?? 12,
              objectFit: 'contain' as const,
              padding: 10,
              imageZoom: 1,
              objectPositionX: 50,
              objectPositionY: 50,
              shadow: 'none' as const,
            }
          : {
              backgroundColor: '#EFEAF8',
              borderRadius: galleryEl.style?.borderRadius ?? 10,
              objectFit: 'cover' as const,
              imageZoom: 1,
              objectPositionX: 50,
              objectPositionY: 50,
              shadow: galleryEl.style?.shadow || ('none' as const),
            },
      };
    });
  };

  // Load selected page into local editor state
  useEffect(() => {
    const found = pages.find((p) => p.id === activePageId);
    if (found) {
      const cloned = structuredClone(found);
      const hasLegacyLogoGallery = cloned.elements.some(
        (el) => el.id === 'p10_gallery' && el.type === 'gallery'
      );
      if (hasLegacyLogoGallery) {
        cloned.elements = cloned.elements.flatMap((el) =>
          el.id === 'p10_gallery' && el.type === 'gallery'
            ? splitGalleryElementToIndividual(el)
            : [el]
        );
      }
      localPageRef.current = cloned;
      historyRef.current = [cloned];
      historyIndexRef.current = 0;
      dirtyRef.current = hasLegacyLogoGallery;
      setLocalPage(cloned);
      setSelectedElementId(null);
      setHistory([cloned]);
      setHistoryIndex(0);
      setSaveState(hasLegacyLogoGallery ? 'saving' : 'idle');
      if (hasLegacyLogoGallery) {
        scheduleAutoSave(cloned);
      }
    }
    // Only reset when activePageId changes so live typing/dragging isn't clobbered by snapshot echo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (dirtyRef.current && localPageRef.current) {
        void saveDraftPage(localPageRef.current, user);
      }
    };
  }, [user]);

  const scheduleAutoSave = (nextPage: PortfolioPage) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    dirtyRef.current = true;
    setSaveState('saving');
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null;
      const latest = localPageRef.current || nextPage;
      dirtyRef.current = false;
      try {
        await saveDraftPage(latest, user);
        setSaveState('saved');
      } catch {
        dirtyRef.current = true;
        setSaveState('error');
      }
    }, 900);
  };

  const commitPageChange = (nextPage: PortfolioPage, pushHistory = true) => {
    localPageRef.current = nextPage;
    setLocalPage(nextPage);
    if (pushHistory) {
      const sliced = historyRef.current.slice(0, historyIndexRef.current + 1);
      const nextHist = [...sliced, structuredClone(nextPage)].slice(-30);
      historyRef.current = nextHist;
      historyIndexRef.current = nextHist.length - 1;
      setHistory(nextHist);
      setHistoryIndex(nextHist.length - 1);
      scheduleAutoSave(nextPage);
    }
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    const nextIdx = historyIndexRef.current - 1;
    const prev = structuredClone(historyRef.current[nextIdx]);
    historyIndexRef.current = nextIdx;
    localPageRef.current = prev;
    setHistoryIndex(nextIdx);
    setLocalPage(prev);
    scheduleAutoSave(prev);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const nextIdx = historyIndexRef.current + 1;
    const next = structuredClone(historyRef.current[nextIdx]);
    historyIndexRef.current = nextIdx;
    localPageRef.current = next;
    setHistoryIndex(nextIdx);
    setLocalPage(next);
    scheduleAutoSave(next);
  };

  const handleManualSave = async () => {
    const current = localPageRef.current;
    if (!current) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      await Promise.all([saveDraftPage(current, user), flushDynamicSaves()]);
      setSaveState('saved');
    } catch {
      dirtyRef.current = true;
      setSaveState('error');
    }
  };

  const handlePublish = async () => {
    await flushAutoSave();
    onPublishClick();
  };

  const handleResetToDefault = async () => {
    const current = localPageRef.current;
    if (!current) return;
    const defaultMatch = DEFAULT_PAGES.find((p) => p.id === current.id);
    const source = defaultMatch ? structuredClone(defaultMatch) : pages.find((p) => p.id === current.id);
    if (!source) return;
    commitPageChange(structuredClone(source), true);
  };

  const handleUpdateElement = (
    elementId: string,
    patch: Partial<CanvasElement>,
    commitHistory = true
  ) => {
    const current = localPageRef.current;
    if (!current) return;
    const nextElements = current.elements.map((el) =>
      el.id === elementId
        ? {
            ...el,
            ...patch,
            style: patch.style ? { ...el.style, ...patch.style } : el.style,
          }
        : el
    );
    commitPageChange({ ...current, elements: nextElements }, commitHistory);
  };

  const fitImageToNaturalRatio = (elementId: string, rawUrl?: string) => {
    const current = localPageRef.current;
    const el = current?.elements.find((item) => item.id === elementId);
    const resolved = resolveAssetUrl(rawUrl || el?.mediaUrl);
    if (!el || !resolved) return;

    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      if (!probe.naturalWidth || !probe.naturalHeight) return;
      const latestPage = localPageRef.current;
      const latestEl = latestPage?.elements.find((item) => item.id === elementId);
      if (!latestEl) return;

      const ratio = probe.naturalWidth / probe.naturalHeight;
      const centerX = latestEl.x + latestEl.w / 2;
      const centerY = latestEl.y + latestEl.h / 2;

      let nextW = Math.max(120, Math.min(960, latestEl.w));
      let nextH = Math.round(nextW / ratio);

      if (nextH > 600) {
        nextH = 600;
        nextW = Math.round(nextH * ratio);
      } else if (nextH < 72) {
        nextH = 72;
        nextW = Math.min(1120, Math.round(nextH * ratio));
      }

      const nextX = Math.max(0, Math.min(1280 - nextW, Math.round(centerX - nextW / 2)));
      const nextY = Math.max(0, Math.min(720 - nextH, Math.round(centerY - nextH / 2)));

      handleUpdateElement(
        elementId,
        {
          x: nextX,
          y: nextY,
          w: nextW,
          h: nextH,
        },
        true
      );
    };
    probe.src = resolved;
  };

  const alignSelectedElement = (
    alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom' | 'fit-canvas'
  ) => {
    const current = localPageRef.current;
    const el = current?.elements.find((item) => item.id === selectedElementId);
    if (!el || el.locked) return;

    const marginX = 64;
    const marginY = 56;
    if (alignment === 'left') {
      handleUpdateElement(el.id, { x: marginX }, true);
    } else if (alignment === 'center-h') {
      handleUpdateElement(el.id, { x: Math.round((1280 - el.w) / 2) }, true);
    } else if (alignment === 'right') {
      handleUpdateElement(el.id, { x: Math.round(1280 - marginX - el.w) }, true);
    } else if (alignment === 'top') {
      handleUpdateElement(el.id, { y: marginY }, true);
    } else if (alignment === 'center-v') {
      handleUpdateElement(el.id, { y: Math.round((720 - el.h) / 2) }, true);
    } else if (alignment === 'bottom') {
      handleUpdateElement(el.id, { y: Math.round(720 - marginY - el.h) }, true);
    } else if (alignment === 'fit-canvas') {
      handleUpdateElement(el.id, { x: 0, y: 0, w: 1280, h: 720 }, true);
    }
  };

  const applyAspectRatioToSelected = (ratioW: number, ratioH: number) => {
    const current = localPageRef.current;
    const el = current?.elements.find((item) => item.id === selectedElementId);
    if (!el || el.locked) return;
    const centerY = el.y + el.h / 2;
    let nextH = Math.round((el.w * ratioH) / ratioW);
    let nextW = el.w;
    if (nextH > 640) {
      nextH = 640;
      nextW = Math.round((nextH * ratioW) / ratioH);
    }
    const nextX = Math.max(0, Math.min(1280 - nextW, el.x));
    const nextY = Math.max(0, Math.min(720 - nextH, Math.round(centerY - nextH / 2)));
    handleUpdateElement(el.id, { x: nextX, y: nextY, w: nextW, h: nextH }, true);
  };

  const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 250, 300];
  const effectiveZoomPct = zoomMode === 'fit' ? fitScalePct : zoomMode;
  effectiveZoomPctRef.current = effectiveZoomPct;
  const panMode = handTool || spaceHeld;
  const canvasWidthPx = Math.max(320, Math.round((1280 * effectiveZoomPct) / 100));

  const applyZoom = (next: 'fit' | number, clientX?: number, clientY?: number) => {
    if (next === 'fit') {
      pendingScrollAnchorRef.current = null;
      setZoomMode('fit');
      return;
    }
    const clamped = Math.max(25, Math.min(300, Math.round(next)));
    const vp = canvasViewportRef.current;
    const box = canvasBoxRef.current;
    if (vp && box) {
      const vpRect = vp.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const anchorClientX = clientX ?? vpRect.left + vpRect.width / 2;
      const anchorClientY = clientY ?? vpRect.top + vpRect.height / 2;
      if (boxRect.width > 0 && boxRect.height > 0) {
        pendingScrollAnchorRef.current = {
          u: (anchorClientX - boxRect.left) / boxRect.width,
          v: (anchorClientY - boxRect.top) / boxRect.height,
          vpOffsetX: anchorClientX - vpRect.left,
          vpOffsetY: anchorClientY - vpRect.top,
        };
      }
    }
    setZoomMode(clamped);
  };

  const stepZoom = (dir: 'in' | 'out') => {
    const curr = effectiveZoomPctRef.current;
    if (dir === 'in') {
      const nextStep = ZOOM_PRESETS.find((z) => z > curr + 2) ?? Math.min(300, curr + 25);
      applyZoom(nextStep);
    } else {
      const prevStep =
        [...ZOOM_PRESETS].reverse().find((z) => z < curr - 2) ?? Math.max(25, curr - 25);
      applyZoom(prevStep);
    }
  };

  const focusSelectedElement = () => {
    const current = localPageRef.current;
    const el = current?.elements.find((item) => item.id === selectedElementId);
    const vp = canvasViewportRef.current;
    if (!el || !vp) return;
    const vpRect = vp.getBoundingClientRect();
    const targetZoom = Math.max(effectiveZoomPctRef.current, 175);
    pendingScrollAnchorRef.current = {
      u: Math.max(0, Math.min(1, (el.x + el.w / 2) / 1280)),
      v: Math.max(0, Math.min(1, (el.y + el.h / 2) / 720)),
      vpOffsetX: vpRect.width / 2,
      vpOffsetY: vpRect.height / 2,
    };
    setZoomMode(Math.min(300, targetZoom));
  };

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    if (!anchor) return;
    pendingScrollAnchorRef.current = null;
    const vp = canvasViewportRef.current;
    const box = canvasBoxRef.current;
    if (!vp || !box) return;
    const vpRect = vp.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const pointX = boxRect.left + anchor.u * boxRect.width;
    const pointY = boxRect.top + anchor.v * boxRect.height;
    const targetX = vpRect.left + anchor.vpOffsetX;
    const targetY = vpRect.top + anchor.vpOffsetY;
    vp.scrollLeft += pointX - targetX;
    vp.scrollTop += pointY - targetY;
  }, [zoomMode, canvasWidthPx]);

  useEffect(() => {
    const vp = canvasViewportRef.current;
    if (!vp) return;
    const updateFit = () => {
      const availW = Math.max(320, vp.clientWidth - 72);
      const availH = Math.max(200, vp.clientHeight - 72);
      const fitRatio = Math.min(availW / 1280, availH / 720, 1);
      setFitScalePct(Math.max(25, Math.min(100, Math.floor(fitRatio * 100))));
    };
    updateFit();
    const ro = new ResizeObserver(updateFit);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const vp = canvasViewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const curr = effectiveZoomPctRef.current;
      const clampedDelta = Math.max(-120, Math.min(120, e.deltaY));
      const factor = Math.exp(-clampedDelta * 0.0032);
      let next = Math.round(curr * factor);
      if (next === curr) {
        next = curr + (e.deltaY < 0 ? 5 : -5);
      }
      applyZoom(next, e.clientX, e.clientY);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const handleViewportPanStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const isMiddle = e.button === 1;
    if (!panMode && !isMiddle) return;
    const vp = canvasViewportRef.current;
    if (!vp) return;
    e.preventDefault();
    setIsPanning(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = vp.scrollLeft;
    const origTop = vp.scrollTop;

    const onMove = (ev: PointerEvent) => {
      vp.scrollLeft = origLeft - (ev.clientX - startX);
      vp.scrollTop = origTop - (ev.clientY - startY);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setIsPanning(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  useEffect(() => {
    const isTypingTarget = (target: HTMLElement | null) => {
      const tag = target?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTypingTarget(target)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          stepZoom('in');
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          stepZoom('out');
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          applyZoom('fit');
          return;
        }
        if (e.key === '1') {
          e.preventDefault();
          applyZoom(100);
          return;
        }
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setHandTool((v) => !v);
        return;
      }

      const current = localPageRef.current;
      const el = current?.elements.find((item) => item.id === selectedElementId);
      if (!el || el.locked) return;

      const step = e.shiftKey ? 16 : 2;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleUpdateElement(el.id, { x: Math.round(el.x - step) }, true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleUpdateElement(el.id, { x: Math.round(el.x + step) }, true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleUpdateElement(el.id, { y: Math.round(el.y - step) }, true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleUpdateElement(el.id, { y: Math.round(el.y + step) }, true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteElement(el.id);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
      }
    };

    const onBlur = () => setSpaceHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementId]);

  const handleAddElement = (type: ElementType, preset?: 'company-logo') => {
    const current = localPageRef.current;
    if (!current) return;
    const maxZ = current.elements.reduce((m, e) => Math.max(m, e.zIndex || 1), 1);
    const id =
      preset === 'company-logo' && current.id === 'page_10'
        ? `p10_logo_${Date.now()}`
        : `el_${Date.now()}`;
    const baseStyle = {
      borderRadius: 10,
      opacity: 1,
    };

    let newEl: CanvasElement = {
      id,
      type,
      name: `Nuevo ${type}`,
      x: 160,
      y: 160,
      w: 360,
      h: 96,
      zIndex: maxZ + 1,
      style: baseStyle,
    };

    if (type === 'heading') {
      newEl = {
        ...newEl,
        name: 'Título Editorial',
        w: 520,
        h: 90,
        content: 'Nuevo Titular Editable',
        style: { ...baseStyle, fontSize: 40, fontWeight: 600, lineHeight: 1.12 },
      };
    } else if (type === 'text') {
      newEl = {
        ...newEl,
        name: 'Bloque de Texto',
        w: 440,
        h: 110,
        content: 'Haz doble clic para editar este texto directamente sobre el lienzo 16:9.',
        style: { ...baseStyle, fontSize: 16, lineHeight: 1.55 },
      };
    } else if (type === 'button') {
      newEl = {
        ...newEl,
        name: 'Botón Interactivo',
        w: 220,
        h: 48,
        content: 'Cotizar Proyecto',
        linkAction: 'whatsapp',
        style: {
          ...baseStyle,
          backgroundColor: config.visualIdentity.primaryColor,
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: 600,
        },
      };
    } else if (type === 'card') {
      newEl = {
        ...newEl,
        name: 'Tarjeta Informativa',
        w: 340,
        h: 220,
        content: 'Título de Tarjeta',
        secondaryContent: 'Descripción editable de servicio, entregable o destaque comercial.',
        style: {
          ...baseStyle,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: 'rgba(20,20,19,0.1)',
          padding: 24,
          fontSize: 20,
          fontWeight: 600,
        },
      };
    } else if (type === 'image' && preset === 'company-logo') {
      newEl = {
        ...newEl,
        name: 'Logo · Nueva Empresa',
        w: 180,
        h: 110,
        content: 'Nombre de Empresa',
        mediaUrl: '',
        style: {
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: 'rgba(109,40,217,0.12)',
          borderRadius: 12,
          objectFit: 'contain',
          padding: 10,
          imageZoom: 1,
          objectPositionX: 50,
          objectPositionY: 50,
          shadow: 'none',
        },
      };
    } else if (type === 'image') {
      newEl = {
        ...newEl,
        name: 'Fotografía',
        w: 420,
        h: 320,
        content: 'Imagen del portafolio',
        mediaUrl: mediaItems[0]?.url || '',
        style: { ...baseStyle, objectFit: 'cover', objectPositionX: 50, objectPositionY: 50, imageZoom: 1 },
      };
    } else if (type === 'video') {
      newEl = {
        ...newEl,
        name: 'Área de Video (Link)',
        w: 480,
        h: 320,
        content: 'Haz clic en la imagen para ver o descargar el video',
        mediaUrl: '',
        videoClickMode: 'online',
        posterUrl:
          mediaItems.find((m) => m.mediaType !== 'video')?.url ||
          '/assets/images/showcase_video_production_1794757025032.jpg',
        style: { ...baseStyle, backgroundColor: '#141413', color: '#FFFFFF' },
      };
    } else if (type === 'shape') {
      newEl = {
        ...newEl,
        name: 'Elemento Decorativo',
        w: 280,
        h: 180,
        style: { ...baseStyle, backgroundColor: config.visualIdentity.accentColor, opacity: 0.18 },
      };
    } else if (type === 'divider') {
      newEl = {
        ...newEl,
        name: 'Línea Divisoria',
        w: 480,
        h: 2,
        style: { ...baseStyle, backgroundColor: '#141413', opacity: 0.25 },
      };
    } else if (type === 'gallery') {
      newEl = {
        ...newEl,
        name: 'Galería Dinámica',
        w: 760,
        h: 380,
        galleryColumns: 3,
        galleryItems: mediaItems.slice(0, 3).map((m, idx) => ({
          id: `gal_${Date.now()}_${idx}`,
          url: m.url,
          title: m.name,
          category: m.category || 'Proyecto',
          mediaType: m.mediaType === 'video' ? 'video' : 'image',
        })),
        style: { ...baseStyle, backgroundColor: '#FFFFFF', padding: 16 },
      };
    } else if (type === 'stats-row') {
      newEl = {
        ...newEl,
        name: 'Métricas y Cifras',
        w: 720,
        h: 130,
        statsItems: [
          { id: `st_${Date.now()}_1`, value: '+150', label: 'Proyectos entregados' },
          { id: `st_${Date.now()}_2`, value: '98%', label: 'Clientes satisfechos' },
        ],
        style: { ...baseStyle, backgroundColor: '#FFFFFF' },
      };
    } else if (type === 'services-grid') {
      newEl = {
        ...newEl,
        name: 'Grilla de Servicios',
        x: 72,
        y: 172,
        w: 1136,
        h: 470,
        style: { ...baseStyle, backgroundColor: config.visualIdentity.surfaceColor },
      };
    } else if (type === 'packages-grid') {
      newEl = {
        ...newEl,
        name: 'Grilla de Planes',
        x: 72,
        y: 172,
        w: 1136,
        h: 490,
        packageCategory: 'branding',
        style: { ...baseStyle, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24 },
      };
    } else if (type === 'testimonials-grid') {
      newEl = {
        ...newEl,
        name: 'Grilla de Testimonios',
        x: 72,
        y: 180,
        w: 1136,
        h: 440,
        style: { ...baseStyle, backgroundColor: config.visualIdentity.surfaceColor },
      };
    } else if (type === 'contact-block') {
      newEl = {
        ...newEl,
        name: 'Bloque de Contacto',
        x: 72,
        y: 260,
        w: 760,
        h: 220,
        style: { ...baseStyle, backgroundColor: config.visualIdentity.surfaceColor, borderRadius: 16 },
      };
    }

    commitPageChange({ ...current, elements: [...current.elements, newEl] }, true);
    setSelectedElementId(id);
    setShowAddMenu(false);
  };

  const handleSplitGallery = (galleryEl: CanvasElement) => {
    const current = localPageRef.current;
    if (!current || galleryEl.type !== 'gallery') return;
    const expanded = splitGalleryElementToIndividual(galleryEl);
    if (expanded.length === 0) return;
    const nextElements = current.elements.flatMap((el) =>
      el.id === galleryEl.id ? expanded : [el]
    );
    commitPageChange({ ...current, elements: nextElements }, true);
    setSelectedElementId(expanded[0].id);
  };

  const handleSplitDynamicBlock = (blockEl: CanvasElement) => {
    const current = localPageRef.current;
    if (!current) return;
    if (
      blockEl.type !== 'packages-grid' &&
      blockEl.type !== 'services-grid' &&
      blockEl.type !== 'testimonials-grid' &&
      blockEl.type !== 'contact-block'
    ) {
      return;
    }
    const expanded = splitDynamicBlockToElements(blockEl, {
      identity: config.visualIdentity,
      contact: localContact,
      services: localServices,
      packages: localPackages,
      testimonials: localTestimonials,
      accentColor: current.accentColorOverride,
    });
    if (expanded.length === 0) return;
    const remainingSlots = Math.max(0, 100 - (current.elements.length - 1));
    const capped = expanded.slice(0, remainingSlots);
    if (capped.length === 0) return;
    const nextElements = current.elements.flatMap((el) =>
      el.id === blockEl.id ? capped : [el]
    );
    commitPageChange({ ...current, elements: nextElements }, true);
    setSelectedElementId(capped[0].id);
    setDynamicEditModal(null);
  };

  const handleDuplicateElement = (el: CanvasElement) => {
    const current = localPageRef.current;
    if (!current) return;
    const maxZ = current.elements.reduce((m, e) => Math.max(m, e.zIndex || 1), 1);
    const copyId =
      el.id.startsWith('p10_logo_') ? `p10_logo_${Date.now()}` : `el_${Date.now()}`;
    const copy: CanvasElement = {
      ...structuredClone(el),
      id: copyId,
      name: `${el.name} (Copia)`,
      x: Math.min(1180, el.x + 24),
      y: Math.min(640, el.y + 24),
      zIndex: maxZ + 1,
      locked: false,
    };
    commitPageChange({ ...current, elements: [...current.elements, copy] }, true);
    setSelectedElementId(copy.id);
  };

  const handleDeleteElement = (elementId: string) => {
    const current = localPageRef.current;
    if (!current) return;
    commitPageChange(
      { ...current, elements: current.elements.filter((e) => e.id !== elementId) },
      true
    );
    if (selectedElementId === elementId) setSelectedElementId(null);
  };

  const handleMoveLayer = (elementId: string, dir: 'up' | 'down') => {
    const current = localPageRef.current;
    if (!current) return;
    const sorted = [...current.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const idx = sorted.findIndex((e) => e.id === elementId);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx + 1 : idx - 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const temp = sorted[idx];
    sorted[idx] = sorted[swapIdx];
    sorted[swapIdx] = temp;
    const reindexed = sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
    commitPageChange({ ...current, elements: reindexed }, true);
  };

  const handleDirectUploadForSelected = async (file: File | undefined) => {
    const targetId = pendingUploadElementIdRef.current || selectedElementId;
    pendingUploadElementIdRef.current = null;
    const currentEl = localPageRef.current?.elements.find((e) => e.id === targetId);
    if (!file || !currentEl || !localPageRef.current) return;
    const hadMediaBefore = Boolean(currentEl.mediaUrl);
    const isLogoStyle = currentEl.style?.objectFit === 'contain';
    setDirectUploading(true);
    setDirectUploadPct(0);
    setDirectUploadError(null);
    try {
      const uploaded = await uploadMediaFile(file, user, {
        mediaTypeOverride: isLogoStyle ? 'logo' : undefined,
        onProgress: (pct) => setDirectUploadPct(pct),
      });
      if (currentEl.type === 'video') {
        handleUpdateElement(currentEl.id, { posterUrl: uploaded.url }, true);
      } else {
        handleUpdateElement(currentEl.id, { mediaUrl: uploaded.url }, true);
        if (currentEl.type === 'image' && !hadMediaBefore && !isLogoStyle) {
          fitImageToNaturalRatio(currentEl.id, uploaded.url);
        }
      }
    } catch (err) {
      setDirectUploadError(err instanceof Error ? err.message : 'Error subiendo archivo');
    } finally {
      setDirectUploading(false);
      setDirectUploadPct(0);
    }
  };

  const triggerDirectUploadForElement = (elId: string) => {
    pendingUploadElementIdRef.current = elId;
    setSelectedElementId(elId);
    directUploadRef.current?.click();
  };

  const scaleSelectedBox = (factor: number) => {
    const current = localPageRef.current;
    const el = current?.elements.find((item) => item.id === selectedElementId);
    if (!el || el.locked) return;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const nextW = Math.max(36, Math.min(1280, Math.round(el.w * factor)));
    const nextH = Math.max(24, Math.min(720, Math.round(el.h * factor)));
    const nextX = Math.max(0, Math.min(1280 - nextW, Math.round(cx - nextW / 2)));
    const nextY = Math.max(0, Math.min(720 - nextH, Math.round(cy - nextH / 2)));
    handleUpdateElement(el.id, { x: nextX, y: nextY, w: nextW, h: nextH }, true);
  };

  if (!localPage) {
    return <div className="p-8 text-sm text-stone-400">Cargando página en el editor...</div>;
  }

  const selectedElement = localPage.elements.find((e) => e.id === selectedElementId) || null;
  const layersDesc = [...localPage.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  return (
    <div className="flex flex-col h-full bg-[#111214] text-stone-100 overflow-hidden">
      {/* Top Editor Toolbar */}
      <div className="h-14 px-4 border-b border-white/10 bg-[#17181B] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <select
            value={localPage.id}
            onChange={(e) => switchActivePage(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-[#101113] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-500 max-w-[200px]"
          >
            {pages.map((p, idx) => (
              <option key={p.id} value={p.id}>
                {String(idx + 1).padStart(2, '0')} · {p.title} {!p.visible ? '(Oculta)' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            title="Crear nueva página"
            onClick={() => setShowCreatePageModal(true)}
            className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={pages.length <= 1}
            title={pages.length <= 1 ? 'Debe quedar al menos 1 página' : 'Eliminar página actual'}
            onClick={() => {
              setAlsoDeletePublished(true);
              setPageToDelete(localPage);
            }}
            className="p-1.5 text-stone-300 hover:text-red-400 hover:bg-white/10 rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-white/10 mx-1" />

          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Deshacer"
            className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-md disabled:opacity-30 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Rehacer"
            className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-md disabled:opacity-30 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-white/10 mx-1" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar elemento</span>
            </button>

            {showAddMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-64 max-h-[70vh] overflow-y-auto bg-[#1D1E22] border border-white/15 rounded-xl shadow-2xl p-1.5 z-50">
                {[
                  { key: 'heading', type: 'heading' as ElementType, label: 'Título editorial', icon: Type },
                  { key: 'text', type: 'text' as ElementType, label: 'Párrafo / Texto', icon: Type },
                  { key: 'button', type: 'button' as ElementType, label: 'Botón / Enlace web', icon: MousePointerClick },
                  { key: 'company-logo', type: 'image' as ElementType, preset: 'company-logo' as const, label: 'Logo de empresa (individual)', icon: ImageIcon },
                  { key: 'image', type: 'image' as ElementType, label: 'Fotografía / GIF / Imagen', icon: ImageIcon },
                  { key: 'video', type: 'video' as ElementType, label: 'Área de Video (Link + Portada)', icon: Video },
                  { key: 'card', type: 'card' as ElementType, label: 'Tarjeta con enlace', icon: Square },
                  { key: 'gallery', type: 'gallery' as ElementType, label: 'Galería de proyectos', icon: Grid },
                  { key: 'packages-grid', type: 'packages-grid' as ElementType, label: 'Tabla de Planes / Precios', icon: CreditCard },
                  { key: 'services-grid', type: 'services-grid' as ElementType, label: 'Grilla de Servicios', icon: Briefcase },
                  { key: 'testimonials-grid', type: 'testimonials-grid' as ElementType, label: 'Bloque de Testimonios', icon: MessageSquareQuote },
                  { key: 'stats-row', type: 'stats-row' as ElementType, label: 'Métricas y cifras', icon: Star },
                  { key: 'contact-block', type: 'contact-block' as ElementType, label: 'Bloque de Contacto', icon: Mail },
                  { key: 'shape', type: 'shape' as ElementType, label: 'Forma decorativa', icon: Square },
                  { key: 'divider', type: 'divider' as ElementType, label: 'Línea divisoria', icon: Minus },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleAddElement(opt.type, opt.preset)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-200 hover:bg-white/10 rounded-lg cursor-pointer text-left"
                    >
                      <Icon className="w-3.5 h-3.5 text-amber-400" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSnapToGrid((v) => !v)}
            className={`px-2.5 py-1.5 text-xs rounded-md cursor-pointer whitespace-nowrap ${
              snapToGrid ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30' : 'text-stone-400 hover:bg-white/5'
            }`}
          >
            Ajuste a retícula
          </button>

          <div className="flex items-center gap-1 bg-[#101113] border border-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setHandTool((v) => !v)}
              title="Herramienta Mano / Mover lienzo (Tecla H o mantener Espacio)"
              className={`p-1 rounded cursor-pointer ${
                panMode ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => stepZoom('out')}
              disabled={effectiveZoomPct <= 25}
              title="Alejar (Ctrl -)"
              className="p-1 text-stone-300 hover:text-white hover:bg-white/10 rounded cursor-pointer disabled:opacity-30"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <select
              value={zoomMode === 'fit' ? 'fit' : String(zoomMode)}
              onChange={(e) => {
                const v = e.target.value;
                applyZoom(v === 'fit' ? 'fit' : Number(v));
              }}
              title="Nivel de zoom"
              className="px-1.5 py-1 text-xs bg-transparent text-stone-200 focus:outline-none tabular-nums cursor-pointer"
            >
              <option value="fit" className="bg-[#17181B]">
                Ajustar ({fitScalePct}%)
              </option>
              {zoomMode !== 'fit' && !ZOOM_PRESETS.includes(zoomMode) && (
                <option value={String(zoomMode)} className="bg-[#17181B]">
                  {zoomMode}%
                </option>
              )}
              {ZOOM_PRESETS.map((z) => (
                <option key={z} value={String(z)} className="bg-[#17181B]">
                  {z}%
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => stepZoom('in')}
              disabled={effectiveZoomPct >= 300}
              title="Acercar (Ctrl +)"
              className="p-1 text-stone-300 hover:text-white hover:bg-white/10 rounded cursor-pointer disabled:opacity-30"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {selectedElementId && (
              <button
                type="button"
                onClick={focusSelectedElement}
                title="Enfocar elemento seleccionado"
                className="p-1 text-amber-300 hover:text-amber-200 hover:bg-white/10 rounded cursor-pointer"
              >
                <ScanSearch className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-stone-400 mr-1 hidden xl:inline">
            {saveState === 'saving'
              ? 'Guardando borrador...'
              : saveState === 'saved'
              ? 'Guardado automático'
              : saveState === 'error'
              ? 'Error al guardar'
              : 'Sincronizado'}
          </span>

          <button
            type="button"
            onClick={handleResetToDefault}
            title="Restablecer diseño base de esta página"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-stone-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Restablecer</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vista previa</span>
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-stone-900 hover:bg-stone-200 rounded-lg cursor-pointer"
          >
            {saveState === 'saved' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Save className="w-3.5 h-3.5" />}
            <span>Guardar</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePublish()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
          >
            <span>Publicar</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel: Layers & Pages */}
        <aside className="w-64 border-r border-white/10 bg-[#151619] flex flex-col shrink-0">
          <div className="grid grid-cols-2 border-b border-white/10 p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setLeftTab('layers')}
              className={`py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 cursor-pointer ${
                leftTab === 'layers' ? 'bg-white/10 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Capas ({localPage.elements.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('pages')}
              className={`py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 cursor-pointer ${
                leftTab === 'pages' ? 'bg-white/10 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Páginas ({pages.length})</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {leftTab === 'layers' ? (
              layersDesc.map((el) => {
                const isSel = selectedElementId === el.id;
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSel ? 'bg-amber-600/20 text-amber-200 border border-amber-500/40' : 'hover:bg-white/5 text-stone-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{el.name}</div>
                      <div className="text-[10px] text-stone-500 uppercase">{el.type}</div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        title="Subir capa"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveLayer(el.id, 'up');
                        }}
                        className="p-1 text-stone-400 hover:text-white"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Bajar capa"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveLayer(el.id, 'down');
                        }}
                        className="p-1 text-stone-400 hover:text-white"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title={el.hidden ? 'Mostrar' : 'Ocultar'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateElement(el.id, { hidden: !el.hidden }, true);
                        }}
                        className="p-1 text-stone-400 hover:text-white"
                      >
                        {el.hidden ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        title={el.locked ? 'Desbloquear' : 'Bloquear'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateElement(el.id, { locked: !el.locked }, true);
                        }}
                        className="p-1 text-stone-400 hover:text-white"
                      >
                        {el.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePageModal(true)}
                  className="w-full py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva página</span>
                </button>
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-2 rounded-lg transition-colors border ${
                      p.id === localPage.id
                        ? 'bg-amber-600/20 border-amber-500/40'
                        : 'border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 text-xs mb-1.5">
                      <button
                        type="button"
                        onClick={() => switchActivePage(p.id)}
                        className="flex-1 min-w-0 text-left flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="font-mono tabular-nums text-[10px] text-amber-400 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="font-medium text-stone-100 truncate">{p.title}</span>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          title={p.visible ? 'Ocultar página' : 'Mostrar página'}
                          onClick={() => void saveDraftPage({ ...p, visible: !p.visible }, user)}
                          className="p-1 text-stone-400 hover:text-white rounded cursor-pointer"
                        >
                          {p.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-amber-400" />}
                        </button>
                        <button
                          type="button"
                          disabled={pages.length <= 1}
                          title={pages.length <= 1 ? 'Debe quedar al menos 1 página' : 'Eliminar página'}
                          onClick={() => {
                            setAlsoDeletePublished(true);
                            setPageToDelete(p);
                          }}
                          className="p-1 text-stone-400 hover:text-red-400 rounded cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div
                      onClick={() => switchActivePage(p.id)}
                      className="aspect-video rounded overflow-hidden border border-white/10 cursor-pointer"
                    >
                      <div className="pointer-events-none w-full h-full">
                        <SlideRenderer
                          page={p}
                          identity={config.visualIdentity}
                          contact={localContact}
                          services={localServices}
                          packages={localPackages}
                          testimonials={localTestimonials}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center Interactive 16:9 Canvas */}
        <main className="flex-1 min-w-0 bg-[#0C0D0F] relative flex flex-col overflow-hidden">
          <div
            ref={canvasViewportRef}
            onPointerDown={handleViewportPanStart}
            className={`flex-1 overflow-auto relative ${
              isPanning ? 'cursor-grabbing' : panMode ? 'cursor-grab' : ''
            }`}
          >
            <div className="min-w-full min-h-full w-max flex p-8 sm:p-12">
              <div
                ref={canvasBoxRef}
                className="m-auto shadow-[0_28px_72px_rgba(0,0,0,0.75)] ring-1 ring-white/15 rounded-lg overflow-hidden shrink-0"
                style={{ width: `${canvasWidthPx}px` }}
              >
                <SlideRenderer
                  page={localPage}
                  identity={config.visualIdentity}
                  contact={localContact}
                  services={localServices}
                  packages={localPackages}
                  testimonials={localTestimonials}
                  editMode={true}
                  panMode={panMode}
                  selectedElementId={selectedElementId}
                  snapToGrid={snapToGrid}
                  onSelectElement={setSelectedElementId}
                  onUpdateElement={handleUpdateElement}
                  onQuickUploadElement={(el) => triggerDirectUploadForElement(el.id)}
                  onQuickPickMedia={(el) => {
                    setSelectedElementId(el.id);
                    setMediaPickerTarget({
                      mode: el.type === 'video' ? 'element-poster' : 'element-image',
                    });
                  }}
                  onQuickEditDynamic={openDynamicEditor}
                  onSplitDynamicBlock={handleSplitDynamicBlock}
                  onInlineUpdatePackage={updatePackageDraft}
                  onInlineUpdateService={updateServiceDraft}
                  onInlineUpdateTestimonial={updateTestimonialDraft}
                  onInlineUpdateContact={updateContactDraft}
                  onDuplicateElement={handleDuplicateElement}
                  onDeleteElement={handleDeleteElement}
                />
              </div>
            </div>
          </div>

          {/* Floating Bottom-Right Zoom & Pan HUD */}
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#17181B]/95 backdrop-blur border border-white/15 shadow-2xl text-xs text-stone-200 select-none">
            <button
              type="button"
              onClick={() => setHandTool((v) => !v)}
              title="Mover lienzo (Espacio + arrastrar o tecla H)"
              className={`p-1.5 rounded cursor-pointer transition-colors ${
                panMode ? 'bg-amber-600 text-white' : 'text-stone-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
            {selectedElementId && (
              <button
                type="button"
                onClick={focusSelectedElement}
                title="Hacer zoom al elemento seleccionado"
                className="p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-white/10 cursor-pointer"
              >
                <ScanSearch className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="h-4 w-px bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={() => stepZoom('out')}
              disabled={effectiveZoomPct <= 25}
              title="Alejar (Ctrl + rueda)"
              className="p-1 rounded text-stone-300 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-30"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min={25}
              max={300}
              step={5}
              value={effectiveZoomPct}
              onChange={(e) => applyZoom(Number(e.target.value))}
              aria-label="Zoom del lienzo"
              className="w-24 accent-amber-500 cursor-pointer hidden sm:block"
            />
            <button
              type="button"
              onClick={() => stepZoom('in')}
              disabled={effectiveZoomPct >= 300}
              title="Acercar (Ctrl + rueda)"
              className="p-1 rounded text-stone-300 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-30"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums text-[11px] text-amber-300 min-w-[38px] text-center">
              {effectiveZoomPct}%
            </span>
            <button
              type="button"
              onClick={() => applyZoom(100)}
              title="Ver a tamaño real 100% (Ctrl + 1)"
              className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer ${
                zoomMode === 100 ? 'bg-white/15 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/10'
              }`}
            >
              1:1
            </button>
            <button
              type="button"
              onClick={() => applyZoom('fit')}
              title="Ajustar lienzo a pantalla (Ctrl + 0)"
              className={`p-1 rounded cursor-pointer ${
                zoomMode === 'fit' ? 'bg-white/15 text-white' : 'text-stone-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

        {/* Right Properties Inspector */}
        <aside className="w-80 border-l border-white/10 bg-[#151619] flex flex-col shrink-0 overflow-y-auto">
          {selectedElement ? (
            <div className="p-4 space-y-5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <div className="font-semibold text-sm text-white truncate max-w-[170px]">
                    {selectedElement.name}
                  </div>
                  <div className="text-[11px] text-stone-400 uppercase">{selectedElement.type}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Duplicar elemento"
                    onClick={() => handleDuplicateElement(selectedElement)}
                    className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title={selectedElement.locked ? 'Desbloquear' : 'Bloquear'}
                    onClick={() =>
                      handleUpdateElement(selectedElement.id, { locked: !selectedElement.locked }, true)
                    }
                    className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
                  >
                    {selectedElement.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    title="Eliminar elemento"
                    onClick={() => handleDeleteElement(selectedElement.id)}
                    className="p-1.5 text-stone-300 hover:text-red-400 hover:bg-white/10 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-stone-400">Nombre de capa</label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(e) => handleUpdateElement(selectedElement.id, { name: e.target.value }, true)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                />
              </div>

              {/* Text Content */}
              {(['heading', 'text', 'button', 'card'].includes(selectedElement.type)) && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-stone-400">
                      {selectedElement.type === 'card' ? 'Título de tarjeta' : 'Contenido / Texto'}
                    </label>
                    <textarea
                      rows={3}
                      value={selectedElement.content || ''}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { content: e.target.value }, true)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white resize-y"
                    />
                  </div>
                  {selectedElement.type === 'card' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] text-stone-400">Descripción de tarjeta</label>
                        <textarea
                          rows={3}
                          value={selectedElement.secondaryContent || ''}
                          onChange={(e) =>
                            handleUpdateElement(selectedElement.id, { secondaryContent: e.target.value }, true)
                          }
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] text-stone-400">Enlace al hacer clic (opcional)</label>
                        <input
                          type="text"
                          placeholder="https://... (portafolio, Drive, web)"
                          value={selectedElement.linkUrl || ''}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { linkUrl: e.target.value }, true)}
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Button Link Action */}
              {selectedElement.type === 'button' && (
                <div className="space-y-2 p-3 bg-white/[0.03] rounded-lg border border-white/10">
                  <label className="block text-[11px] text-stone-400 font-medium">Acción del botón</label>
                  <select
                    value={selectedElement.linkAction || 'url'}
                    onChange={(e) =>
                      handleUpdateElement(
                        selectedElement.id,
                        { linkAction: e.target.value as CanvasElement['linkAction'] },
                        true
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                  >
                    <option value="next-page">Ir a página siguiente</option>
                    <option value="goto-contact">Ir a página Contacto</option>
                    <option value="whatsapp">Abrir WhatsApp configurado</option>
                    <option value="email">Abrir Correo configurado</option>
                    <option value="url">Enlace externo (URL)</option>
                  </select>
                  {selectedElement.linkAction === 'url' && (
                    <input
                      type="url"
                      placeholder="https://..."
                      value={selectedElement.linkUrl || ''}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { linkUrl: e.target.value }, true)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                    />
                  )}
                </div>
              )}

              {/* Image & Video Controls */}
              {(selectedElement.type === 'image' || selectedElement.type === 'video') && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg border border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-200">
                      {selectedElement.type === 'video' ? 'Área de Video (Link + Portada)' : 'Imagen / Logo Individual'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteElement(selectedElement.id)}
                      title="Eliminar este cuadro del lienzo"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900/70 border border-red-500/35 text-[10px] text-red-200 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Borrar cuadro</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400">
                      {selectedElement.type === 'video' ? 'Título del video' : 'Etiqueta / Nombre visible'}
                    </label>
                    <input
                      type="text"
                      value={selectedElement.content || ''}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { content: e.target.value }, true)}
                      placeholder="Nombre de la empresa o descripción"
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded text-white text-[11px]"
                    />
                  </div>

                  {selectedElement.type === 'image' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMediaPickerTarget({ mode: 'element-image' })}
                          className="py-2 px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-medium cursor-pointer"
                        >
                          Elegir de Biblioteca
                        </button>
                        <button
                          type="button"
                          disabled={directUploading}
                          onClick={() => triggerDirectUploadForElement(selectedElement.id)}
                          className="py-2 px-2.5 bg-white/10 hover:bg-white/15 text-white rounded-md font-medium cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{directUploading ? `Subiendo ${directUploadPct}%` : 'Subir Foto / Logo'}</span>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-stone-400 flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-amber-400" />
                          <span>Pegar URL directa de imagen o logo</span>
                        </label>
                        <input
                          type="text"
                          value={selectedElement.mediaUrl || ''}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { mediaUrl: e.target.value }, true)}
                          placeholder="https://.../logo-o-imagen.png"
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded text-white text-[11px]"
                        />
                      </div>

                      {/* Per-image Popup Toggle */}
                      <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-stone-200 flex items-center gap-1.5">
                            <Expand className="w-3 h-3 text-amber-400" />
                            <span>Popup al hacer clic</span>
                          </div>
                          <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
                            {selectedElement.enablePopup !== false
                              ? 'Abre vista ampliada atractiva al hacer clic.'
                              : 'Desactivado: imagen fija sin ventana emergente.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateElement(
                              selectedElement.id,
                              { enablePopup: selectedElement.enablePopup === false },
                              true
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer shrink-0 border ${
                            selectedElement.enablePopup !== false
                              ? 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200'
                              : 'bg-white/5 border-white/15 text-stone-400 hover:text-white'
                          }`}
                        >
                          {selectedElement.enablePopup !== false ? 'Activado' : 'Desactivado'}
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Video-by-Link + Cover Image Controls */
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-lg bg-black/35 border border-white/10 space-y-2">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-300">
                          1. Imagen visible (al cliquear abre el video)
                        </div>
                        {selectedElement.posterUrl && (
                          <img
                            src={resolveAssetUrl(selectedElement.posterUrl)}
                            alt="Portada del video"
                            referrerPolicy="no-referrer"
                            className="w-full h-24 object-cover rounded border border-white/10 bg-black/40"
                          />
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={directUploading}
                            onClick={() => triggerDirectUploadForElement(selectedElement.id)}
                            className="py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-medium cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
                          >
                            <Upload className="w-3 h-3" />
                            <span>{directUploading ? `${directUploadPct}%` : 'Subir portada'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMediaPickerTarget({ mode: 'element-poster' })}
                            className="py-1.5 px-2 bg-white/10 hover:bg-white/15 text-white rounded text-[11px] font-medium cursor-pointer"
                          >
                            Biblioteca
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={selectedElement.posterUrl || ''}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { posterUrl: e.target.value }, true)}
                            placeholder="O pega URL de imagen portada"
                            className="flex-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white text-[10px]"
                          />
                          {selectedElement.posterUrl && (
                            <button
                              type="button"
                              onClick={() => handleUpdateElement(selectedElement.id, { posterUrl: '' }, true)}
                              className="px-2 py-1 text-[10px] bg-red-950/50 border border-red-500/30 text-red-200 rounded cursor-pointer"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/35 border border-purple-500/30 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-200 flex items-center gap-1">
                            <Link2 className="w-3 h-3 text-amber-400" />
                            <span>2. Link del Video (Online / Descarga)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setMediaPickerTarget({ mode: 'element-video' })}
                            className="text-[10px] text-amber-300 hover:text-amber-200 cursor-pointer underline"
                          >
                            De Biblioteca
                          </button>
                        </div>
                        <input
                          type="text"
                          value={selectedElement.mediaUrl || ''}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { mediaUrl: e.target.value }, true)}
                          placeholder="https://... (enlace del video online o descarga)"
                          className="w-full px-2.5 py-1.5 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                        />
                        {extractGoogleDriveId(selectedElement.mediaUrl || '') && (
                          <div className="text-[10px] text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded px-2 py-1">
                            Enlace de video detectado · Listo para ver online o descargar directo.
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[10px] text-stone-400 block">Al cliquear la imagen:</span>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: 'online', label: 'Ver aquí' },
                                { id: 'external', label: 'Abrir online' },
                                { id: 'download', label: 'Descargar' },
                              ] as const
                            ).map((modeOpt) => (
                              <button
                                key={modeOpt.id}
                                type="button"
                                onClick={() =>
                                  handleUpdateElement(
                                    selectedElement.id,
                                    { videoClickMode: modeOpt.id },
                                    true
                                  )
                                }
                                className={`py-1.5 px-1.5 rounded text-[10px] font-medium cursor-pointer border text-center ${
                                  (selectedElement.videoClickMode || 'online') === modeOpt.id
                                    ? 'bg-amber-600 border-amber-400 text-white'
                                    : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                                }`}
                              >
                                {modeOpt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-white/10 space-y-2">
                          <div>
                            <label className="text-[10px] text-stone-400 block mb-1">
                              Título principal sobre la portada
                            </label>
                            <input
                              type="text"
                              value={selectedElement.content || ''}
                              onChange={(e) =>
                                handleUpdateElement(selectedElement.id, { content: e.target.value }, true)
                              }
                              placeholder="Ej. Showreel Principal"
                              className="w-full px-2.5 py-1.5 bg-black/45 border border-white/15 rounded text-white text-[11px]"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="text-[10px] text-stone-400">
                                Etiqueta superior del link
                              </label>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateElement(
                                      selectedElement.id,
                                      { videoActionLabel: '' },
                                      true
                                    )
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer border ${
                                    selectedElement.videoActionLabel === ''
                                      ? 'bg-amber-600/30 border-amber-400/50 text-amber-200'
                                      : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                                  }`}
                                >
                                  Ocultar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateElement(
                                      selectedElement.id,
                                      { videoActionLabel: undefined },
                                      true
                                    )
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer border ${
                                    selectedElement.videoActionLabel === undefined
                                      ? 'bg-purple-600/30 border-purple-400/50 text-purple-100'
                                      : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                                  }`}
                                >
                                  Auto
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={selectedElement.videoActionLabel ?? ''}
                              onChange={(e) =>
                                handleUpdateElement(
                                  selectedElement.id,
                                  { videoActionLabel: e.target.value },
                                  true
                                )
                              }
                              placeholder={
                                selectedElement.videoActionLabel === ''
                                  ? 'Etiqueta oculta (escribe aquí para mostrar una)'
                                  : 'Personalizar (ej. Ver Reel, Descargar)'
                              }
                              className="w-full px-2.5 py-1.5 bg-black/45 border border-white/15 rounded text-white text-[11px]"
                            />
                          </div>
                        </div>

                        {selectedElement.mediaUrl && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            {(() => {
                              const vt = resolveVideoClickTarget(
                                selectedElement.mediaUrl,
                                selectedElement.videoClickMode,
                                selectedElement.videoActionLabel
                              );
                              return !vt.isEmpty ? (
                                <a
                                  href={vt.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={vt.isDownload ? '' : undefined}
                                  className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 underline"
                                >
                                  {vt.isDownload ? <Download className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                                  <span>{vt.isDownload ? 'Probar descarga' : 'Probar enlace'}</span>
                                </a>
                              ) : (
                                <span />
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => handleUpdateElement(selectedElement.id, { mediaUrl: '' }, true)}
                              className="px-2 py-1 rounded text-[10px] bg-red-950/50 border border-red-500/30 text-red-200 hover:bg-red-900/60 cursor-pointer"
                            >
                              Quitar link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {directUploadError && (
                    <div className="p-2 rounded bg-red-950/60 border border-red-500/40 text-[11px] text-red-200 break-words">
                      {directUploadError}
                    </div>
                  )}

                  {/* Quick Width & Height Resizing right inside the Image/Video panel */}
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-stone-400">Tamaño del cuadro (px)</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={selectedElement.locked}
                          onClick={() => scaleSelectedBox(0.9)}
                          title="Reducir tamaño 10%"
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-stone-200 cursor-pointer disabled:opacity-40"
                        >
                          -10%
                        </button>
                        <button
                          type="button"
                          disabled={selectedElement.locked}
                          onClick={() => scaleSelectedBox(1.1)}
                          title="Aumentar tamaño 10%"
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-stone-200 cursor-pointer disabled:opacity-40"
                        >
                          +10%
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 tabular-nums">
                      <div>
                        <label className="text-[10px] text-stone-400">Ancho (W)</label>
                        <input
                          type="number"
                          min={36}
                          max={1280}
                          disabled={selectedElement.locked}
                          value={Math.round(selectedElement.w)}
                          onChange={(e) =>
                            handleUpdateElement(
                              selectedElement.id,
                              { w: Math.max(36, Math.min(1280, Number(e.target.value) || 36)) },
                              true
                            )
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400">Alto (H)</label>
                        <input
                          type="number"
                          min={24}
                          max={720}
                          disabled={selectedElement.locked}
                          value={Math.round(selectedElement.h)}
                          onChange={(e) =>
                            handleUpdateElement(
                              selectedElement.id,
                              { h: Math.max(24, Math.min(720, Number(e.target.value) || 24)) },
                              true
                            )
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {selectedElement.type === 'image' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-stone-400">Enlace al hacer clic (opcional)</label>
                        <input
                          type="text"
                          value={selectedElement.linkUrl || ''}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { linkUrl: e.target.value }, true)}
                          placeholder="https://instagram.com/... o sitio web"
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded text-white text-[11px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateElement(
                              selectedElement.id,
                              {
                                style: {
                                  backgroundColor: '#FFFFFF',
                                  borderWidth: 1,
                                  borderColor: 'rgba(109,40,217,0.12)',
                                  borderRadius: 12,
                                  objectFit: 'contain',
                                  padding: 10,
                                  shadow: 'none',
                                },
                              },
                              true
                            )
                          }
                          className={`py-1.5 px-2 rounded text-[11px] font-medium cursor-pointer border ${
                            selectedElement.style.backgroundColor === '#FFFFFF' &&
                            selectedElement.style.objectFit === 'contain'
                              ? 'bg-amber-600/25 border-amber-400 text-amber-200'
                              : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                          }`}
                        >
                          Tarjeta blanca (Logo)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateElement(
                              selectedElement.id,
                              {
                                style: {
                                  backgroundColor: 'transparent',
                                  borderWidth: 0,
                                  borderRadius: 0,
                                  objectFit: 'contain',
                                  padding: 0,
                                  shadow: 'md',
                                },
                              },
                              true
                            )
                          }
                          className={`py-1.5 px-2 rounded text-[11px] font-medium cursor-pointer border ${
                            selectedElement.style.backgroundColor === 'transparent'
                              ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                              : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                          }`}
                        >
                          PNG sin fondo
                        </button>
                      </div>

                      {selectedElement.mediaUrl && (
                        <button
                          type="button"
                          onClick={() => handleUpdateElement(selectedElement.id, { mediaUrl: '' }, true)}
                          className="w-full py-1.5 px-2 rounded text-[11px] bg-red-950/50 border border-red-500/30 text-red-200 hover:bg-red-900/60 cursor-pointer"
                        >
                          Quitar imagen (dejar cuadro vacío)
                        </button>
                      )}
                    </>
                  )}

                  {selectedElement.type === 'image' && (
                    <>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-stone-400">Ajuste</label>
                          <select
                            value={selectedElement.style.objectFit || 'cover'}
                            onChange={(e) =>
                              handleUpdateElement(
                                selectedElement.id,
                                { style: { objectFit: e.target.value as 'cover' | 'contain' } },
                                true
                              )
                            }
                            className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                          >
                            <option value="cover">Cubrir (Recorte)</option>
                            <option value="contain">Contener completo (Logo)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-400">
                            Escala interna ({(selectedElement.style.imageZoom || 1).toFixed(2)}x)
                          </label>
                          <input
                            type="range"
                            min="0.4"
                            max="3"
                            step="0.05"
                            value={selectedElement.style.imageZoom || 1}
                            onChange={(e) =>
                              handleUpdateElement(
                                selectedElement.id,
                                { style: { imageZoom: Number(e.target.value) } },
                                true
                              )
                            }
                            className="w-full mt-2 accent-amber-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-400">Encuadre X ({selectedElement.style.objectPositionX ?? 50}%)</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedElement.style.objectPositionX ?? 50}
                            onChange={(e) =>
                              handleUpdateElement(
                                selectedElement.id,
                                { style: { objectPositionX: Number(e.target.value) } },
                                true
                              )
                            }
                            className="w-full mt-1 accent-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-400">Encuadre Y ({selectedElement.style.objectPositionY ?? 50}%)</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedElement.style.objectPositionY ?? 50}
                            onChange={(e) =>
                              handleUpdateElement(
                                selectedElement.id,
                                { style: { objectPositionY: Number(e.target.value) } },
                                true
                              )
                            }
                            className="w-full mt-1 accent-amber-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-stone-400">Proporción y encuadre</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateElement(
                                selectedElement.id,
                                { style: { imageZoom: 1, objectPositionX: 50, objectPositionY: 50 } },
                                true
                              )
                            }
                            className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 cursor-pointer"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>Centrar recorte</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-5 gap-1">
                          <button
                            type="button"
                            disabled={!selectedElement.mediaUrl}
                            onClick={() => fitImageToNaturalRatio(selectedElement.id, selectedElement.mediaUrl)}
                            title="Adaptar caja a la proporción original de la foto"
                            className="col-span-2 py-1 px-1.5 rounded bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/40 text-amber-200 text-[10px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                          >
                            <Proportions className="w-3 h-3" />
                            <span>Original</span>
                          </button>
                          {[
                            { label: '1:1', w: 1, h: 1 },
                            { label: '4:3', w: 4, h: 3 },
                            { label: '16:9', w: 16, h: 9 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => applyAspectRatioToSelected(preset.w, preset.h)}
                              className="py-1 px-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-stone-200 text-[10px] cursor-pointer"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-stone-400 leading-snug">
                          Arrastra las esquinas o bordes para redimensionar cada imagen/logo a tu gusto.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Gallery Items Editor */}
              {selectedElement.type === 'gallery' && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg border border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-200">Elementos de Galería</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowGalleryLinkInput((v) => !v)}
                        className="px-2 py-1 text-[11px] bg-white/10 hover:bg-white/15 text-stone-100 rounded cursor-pointer"
                      >
                        + Enlace
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaPickerTarget({ mode: 'gallery-add' })}
                        className="px-2 py-1 text-[11px] bg-amber-600 text-white rounded cursor-pointer"
                      >
                        + Archivo
                      </button>
                    </div>
                  </div>

                  {(selectedElement.galleryItems || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSplitGallery(selectedElement)}
                      className="w-full py-1.5 px-2.5 rounded-md bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/40 text-purple-100 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Ungroup className="w-3.5 h-3.5" />
                      <span>Separar en imágenes individuales (redimensionables)</span>
                    </button>
                  )}

                  {showGalleryLinkInput && (
                    <div className="p-2.5 bg-black/40 rounded border border-purple-500/30 space-y-1.5">
                      <input
                        type="text"
                        placeholder="Link de video (nube / YouTube / Vimeo) o imagen"
                        value={galleryLinkUrl}
                        onChange={(e) => setGalleryLinkUrl(e.target.value)}
                        className="w-full px-2 py-1 bg-black/50 border border-white/15 rounded text-[11px] text-white"
                      />
                      {isLikelyVideoUrl(galleryLinkUrl) && (
                        <>
                          <input
                            type="text"
                            placeholder="URL de imagen portada (opcional)"
                            value={galleryLinkPosterUrl}
                            onChange={(e) => setGalleryLinkPosterUrl(e.target.value)}
                            className="w-full px-2 py-1 bg-black/50 border border-white/15 rounded text-[11px] text-white"
                          />
                          <select
                            value={galleryLinkVideoAction}
                            onChange={(e) => setGalleryLinkVideoAction(e.target.value as VideoClickMode)}
                            className="w-full px-2 py-1 bg-black/50 border border-white/15 rounded text-[11px] text-white"
                          >
                            <option value="online">Al cliquear imagen: Ver aquí (Reproductor)</option>
                            <option value="external">Al cliquear imagen: Abrir enlace online</option>
                            <option value="download">Al cliquear imagen: Descargar video</option>
                          </select>
                        </>
                      )}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Título del proyecto"
                          value={galleryLinkTitle}
                          onChange={(e) => setGalleryLinkTitle(e.target.value)}
                          className="flex-1 px-2 py-1 bg-black/50 border border-white/15 rounded text-[11px] text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = galleryLinkUrl.trim();
                            if (!url) return;
                            const isVid = isLikelyVideoUrl(url);
                            const nextItem: GalleryMediaItem = {
                              id: `gal_${Date.now()}`,
                              url: isVid
                                ? galleryLinkPosterUrl.trim() || '/assets/images/showcase_video_production_1794757025032.jpg'
                                : url,
                              videoUrl: isVid ? url : undefined,
                              videoAction: isVid ? galleryLinkVideoAction : undefined,
                              title: galleryLinkTitle.trim() || 'Proyecto',
                              category: isVid ? 'Video' : 'Proyecto',
                              year: String(new Date().getFullYear()),
                              mediaType: isVid ? 'video' : 'image',
                            };
                            handleUpdateElement(
                              selectedElement.id,
                              { galleryItems: [...(selectedElement.galleryItems || []), nextItem] },
                              true
                            );
                            setGalleryLinkUrl('');
                            setGalleryLinkPosterUrl('');
                            setGalleryLinkTitle('');
                            setShowGalleryLinkInput(false);
                          }}
                          className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-medium cursor-pointer"
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-400">Columnas</label>
                      <select
                        value={selectedElement.galleryColumns || 3}
                        onChange={(e) =>
                          handleUpdateElement(selectedElement.id, { galleryColumns: Number(e.target.value) }, true)
                        }
                        className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                      >
                        <option value={2}>2 columnas</option>
                        <option value={3}>3 columnas</option>
                        <option value={4}>4 columnas</option>
                        <option value={5}>5 columnas</option>
                        <option value={6}>6 columnas</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400">Estilo de encuadre</label>
                      <select
                        value={selectedElement.style.objectFit || 'cover'}
                        onChange={(e) =>
                          handleUpdateElement(
                            selectedElement.id,
                            { style: { objectFit: e.target.value as 'cover' | 'contain' } },
                            true
                          )
                        }
                        className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                      >
                        <option value="cover">Fotografía (Cubrir)</option>
                        <option value="contain">Logotipos (Contener)</option>
                      </select>
                    </div>
                  </div>

                  {(selectedElement.galleryItems || []).length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                      <span className="text-[10px] text-stone-400">Popup en imágenes:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const next = (selectedElement.galleryItems || []).map((x) => ({
                              ...x,
                              enablePopup: true,
                            }));
                            handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-500/30 text-[10px] text-emerald-200 cursor-pointer"
                        >
                          Todas Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (selectedElement.galleryItems || []).map((x) => ({
                              ...x,
                              enablePopup: false,
                            }));
                            handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                          }}
                          className="px-2 py-0.5 rounded bg-white/5 border border-white/15 text-[10px] text-stone-300 cursor-pointer"
                        >
                          Todas No
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(selectedElement.galleryItems || []).map((gItem) => {
                      const gVideoUrl = gItem.videoUrl ?? (gItem.mediaType === 'video' && isLikelyVideoUrl(gItem.url) ? gItem.url : '');
                      return (
                        <div key={gItem.id} className="p-2 bg-black/30 rounded border border-white/10 space-y-1.5">
                          <div className="flex items-center gap-2">
                            {gItem.url ? (
                              <img
                                src={resolveAssetUrl(gItem.url)}
                                alt={gItem.title}
                                referrerPolicy="no-referrer"
                                className="w-10 h-8 object-cover rounded shrink-0 bg-white/10"
                              />
                            ) : (
                              <div className="w-10 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center text-[9px] text-stone-400">
                                IMG
                              </div>
                            )}
                            <input
                              type="text"
                              value={gItem.title}
                              onChange={(e) => {
                                const next = (selectedElement.galleryItems || []).map((x) =>
                                  x.id === gItem.id ? { ...x, title: e.target.value } : x
                                );
                                handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                              }}
                              className="flex-1 px-1.5 py-1 bg-black/40 border border-white/10 rounded text-[11px] text-white"
                            />
                            <button
                              type="button"
                              title={gItem.enablePopup !== false ? 'Desactivar popup en esta imagen' : 'Activar popup en esta imagen'}
                              onClick={() => {
                                const next = (selectedElement.galleryItems || []).map((x) =>
                                  x.id === gItem.id ? { ...x, enablePopup: x.enablePopup === false } : x
                                );
                                handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer border shrink-0 ${
                                gItem.enablePopup !== false
                                  ? 'bg-emerald-600/20 border-emerald-400/40 text-emerald-200'
                                  : 'bg-white/5 border-white/15 text-stone-400'
                              }`}
                            >
                              {gItem.enablePopup !== false ? 'Popup Sí' : 'Sin popup'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = (selectedElement.galleryItems || []).filter((x) => x.id !== gItem.id);
                                handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                              }}
                              className="text-stone-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Categoría"
                              value={gItem.category}
                              onChange={(e) => {
                                const next = (selectedElement.galleryItems || []).map((x) =>
                                  x.id === gItem.id ? { ...x, category: e.target.value } : x
                                );
                                handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                              }}
                              className="flex-1 px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-[10px] text-stone-200"
                            />
                            <button
                              type="button"
                              onClick={() => setMediaPickerTarget({ mode: 'gallery-item', itemId: gItem.id })}
                              className="px-2 py-0.5 bg-amber-600/80 hover:bg-amber-500 rounded text-[10px] text-white cursor-pointer"
                            >
                              Cambiar foto
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Link del video (online o descarga)"
                              value={gVideoUrl}
                              onChange={(e) => {
                                const val = e.target.value;
                                const next = (selectedElement.galleryItems || []).map((x) =>
                                  x.id === gItem.id
                                    ? {
                                        ...x,
                                        videoUrl: val,
                                        mediaType: val.trim() ? ('video' as const) : ('image' as const),
                                      }
                                    : x
                                );
                                handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                              }}
                              className="flex-1 px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-[10px] text-amber-100 placeholder:text-stone-500"
                            />
                            {gVideoUrl.trim() && (
                              <select
                                value={gItem.videoAction || 'online'}
                                onChange={(e) => {
                                  const next = (selectedElement.galleryItems || []).map((x) =>
                                    x.id === gItem.id
                                      ? { ...x, videoAction: e.target.value as VideoClickMode }
                                      : x
                                  );
                                  handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                                }}
                                className="px-1 py-0.5 bg-black/50 border border-white/15 rounded text-[9px] text-white"
                              >
                                <option value="online">Ver aquí</option>
                                <option value="external">Ver online</option>
                                <option value="download">Descargar</option>
                              </select>
                            )}
                          </div>
                          {gVideoUrl.trim() && (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Etiqueta del link (opcional, ej. Ver Reel)"
                                value={gItem.videoActionLabel ?? ''}
                                onChange={(e) => {
                                  const next = (selectedElement.galleryItems || []).map((x) =>
                                    x.id === gItem.id ? { ...x, videoActionLabel: e.target.value } : x
                                  );
                                  handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                                }}
                                className="flex-1 px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-[10px] text-stone-200 placeholder:text-stone-500"
                              />
                              {gItem.videoActionLabel !== undefined && (
                                <button
                                  type="button"
                                  title="Restablecer etiqueta automática"
                                  onClick={() => {
                                    const next = (selectedElement.galleryItems || []).map((x) =>
                                      x.id === gItem.id ? { ...x, videoActionLabel: undefined } : x
                                    );
                                    handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                                  }}
                                  className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[9px] text-stone-300 cursor-pointer"
                                >
                                  Auto
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats Row Editor */}
              {selectedElement.type === 'stats-row' && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-200">Métricas y Cifras</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [
                          ...(selectedElement.statsItems || []),
                          { id: `st_${Date.now()}`, value: '+10', label: 'Nueva métrica destacada' },
                        ];
                        handleUpdateElement(selectedElement.id, { statsItems: next }, true);
                      }}
                      className="px-2 py-1 text-[11px] bg-amber-600 text-white rounded cursor-pointer"
                    >
                      + Métrica
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(selectedElement.statsItems || []).map((st) => (
                      <div key={st.id} className="p-2 bg-black/30 rounded border border-white/10 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={st.value}
                            onChange={(e) => {
                              const next = (selectedElement.statsItems || []).map((x) =>
                                x.id === st.id ? { ...x, value: e.target.value } : x
                              );
                              handleUpdateElement(selectedElement.id, { statsItems: next }, true);
                            }}
                            className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded text-xs font-semibold text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (selectedElement.statsItems || []).filter((x) => x.id !== st.id);
                              handleUpdateElement(selectedElement.id, { statsItems: next }, true);
                            }}
                            className="ml-auto text-stone-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={st.label}
                          onChange={(e) => {
                            const next = (selectedElement.statsItems || []).map((x) =>
                              x.id === st.id ? { ...x, label: e.target.value } : x
                            );
                            handleUpdateElement(selectedElement.id, { statsItems: next }, true);
                          }}
                          className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-[11px] text-stone-200 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Packages Grid Inline Editor */}
              {selectedElement.type === 'packages-grid' && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg border border-amber-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Editar Planes y Precios</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cat = selectedElement.packageCategory || 'branding';
                        const newPkg: PackageItem = {
                          id: `pkg_${Date.now()}`,
                          category: cat,
                          name: 'Nuevo Plan',
                          description: 'Descripción breve del paquete.',
                          price: '',
                          currency: 'USD',
                          billingPeriod: 'Pago único',
                          imageUrl: '',
                          features: ['Entregable principal incluido', 'Asesoría personalizada'],
                          promoLabel: '',
                          isPopular: false,
                          visible: true,
                          order: localPackages.length + 1,
                        };
                        updatePackageDraft(newPkg, true);
                        setEditingPkgId(newPkg.id);
                        setEditingPkgFeaturesText(newPkg.features.join('\n'));
                      }}
                      className="px-2 py-1 text-[11px] font-medium bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                    >
                      + Plan
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDynamicEditor(selectedElement)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Abrir editor visual de planes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSplitDynamicBlock(selectedElement)}
                    className="w-full py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>Separar en tarjetas y textos libres</span>
                  </button>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Haz clic directo sobre cualquier título, precio o punto en la diapositiva para escribir al instante, o usa «Separar» para mover/redimensionar cada tarjeta por separado.
                  </p>

                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Categoría mostrada en este bloque</label>
                    <select
                      value={selectedElement.packageCategory || 'branding'}
                      onChange={(e) => {
                        setEditingPkgId(null);
                        handleUpdateElement(
                          selectedElement.id,
                          { packageCategory: e.target.value as PackageItem['category'] },
                          true
                        );
                      }}
                      className="w-full px-2 py-1.5 bg-black/45 border border-white/15 rounded text-white text-[11px]"
                    >
                      <option value="branding">Identidad Visual (Branding)</option>
                      <option value="social">Diseño para Redes Sociales</option>
                      <option value="video">Edición de Video</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Texto del botón en cada plan</label>
                    <input
                      type="text"
                      placeholder="Solicitar plan"
                      value={selectedElement.content || ''}
                      onChange={(e) =>
                        handleUpdateElement(selectedElement.id, { content: e.target.value }, true)
                      }
                      className="w-full px-2 py-1.5 bg-black/45 border border-white/15 rounded text-white text-[11px]"
                    />
                  </div>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {localPackages
                      .filter((p) => p.category === (selectedElement.packageCategory || 'branding'))
                      .map((pkg) => {
                        const isExpanded = editingPkgId === pkg.id;
                        return (
                          <div
                            key={pkg.id}
                            className={`rounded-md border p-2 space-y-2 ${
                              isExpanded
                                ? 'bg-black/50 border-amber-500/50'
                                : 'bg-black/30 border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-white truncate">
                                  {pkg.name || 'Sin nombre'}
                                </div>
                                <div className="text-[10px] text-stone-400 truncate">
                                  {pkg.price ? `${pkg.currency} ${pkg.price}` : 'A consultar'}
                                  {pkg.isPopular ? ' · Más Popular' : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  title={pkg.isPopular ? 'Quitar destacado' : 'Marcar Más Popular'}
                                  onClick={() =>
                                    updatePackageDraft({ ...pkg, isPopular: !pkg.isPopular }, true)
                                  }
                                  className={`p-1 rounded cursor-pointer ${
                                    pkg.isPopular ? 'text-amber-300' : 'text-stone-500 hover:text-amber-300'
                                  }`}
                                >
                                  <Star className={`w-3.5 h-3.5 ${pkg.isPopular ? 'fill-amber-300' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  title={pkg.visible ? 'Ocultar plan' : 'Mostrar plan'}
                                  onClick={() => updatePackageDraft({ ...pkg, visible: !pkg.visible }, true)}
                                  className="p-1 text-stone-400 hover:text-white rounded cursor-pointer"
                                >
                                  {pkg.visible ? (
                                    <Eye className="w-3.5 h-3.5" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isExpanded) {
                                      setEditingPkgId(null);
                                    } else {
                                      setEditingPkgId(pkg.id);
                                      setEditingPkgFeaturesText((pkg.features || []).join('\n'));
                                    }
                                  }}
                                  className="px-2 py-0.5 text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white rounded cursor-pointer"
                                >
                                  {isExpanded ? 'Listo' : 'Editar'}
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar plan"
                                  onClick={() => {
                                    setLocalPackages((prev) => prev.filter((x) => x.id !== pkg.id));
                                    if (editingPkgId === pkg.id) setEditingPkgId(null);
                                    void deleteDraftPackage(pkg.id);
                                  }}
                                  className="p-1 text-stone-400 hover:text-red-400 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="space-y-2 pt-2 border-t border-white/10">
                                <div>
                                  <label className="text-[10px] text-stone-400">Nombre del plan</label>
                                  <input
                                    type="text"
                                    value={pkg.name}
                                    onChange={(e) =>
                                      updatePackageDraft({ ...pkg, name: e.target.value })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div>
                                    <label className="text-[10px] text-stone-400">Precio</label>
                                    <input
                                      type="text"
                                      placeholder="A consultar"
                                      value={pkg.price || ''}
                                      onChange={(e) =>
                                        updatePackageDraft({ ...pkg, price: e.target.value })
                                      }
                                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] tabular-nums"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-400">Moneda</label>
                                    <input
                                      type="text"
                                      value={pkg.currency}
                                      onChange={(e) =>
                                        updatePackageDraft({ ...pkg, currency: e.target.value })
                                      }
                                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-400">Ciclo</label>
                                    <input
                                      type="text"
                                      placeholder="Pago único"
                                      value={pkg.billingPeriod || ''}
                                      onChange={(e) =>
                                        updatePackageDraft({ ...pkg, billingPeriod: e.target.value })
                                      }
                                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[10px] text-stone-400">Etiqueta promo</label>
                                    <input
                                      type="text"
                                      placeholder="Ej. Más Popular"
                                      value={pkg.promoLabel || ''}
                                      onChange={(e) =>
                                        updatePackageDraft({ ...pkg, promoLabel: e.target.value })
                                      }
                                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-400">Orden</label>
                                    <input
                                      type="number"
                                      value={pkg.order}
                                      onChange={(e) =>
                                        updatePackageDraft({ ...pkg, order: Number(e.target.value) || 0 })
                                      }
                                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] tabular-nums"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-400">Descripción</label>
                                  <textarea
                                    rows={2}
                                    value={pkg.description || ''}
                                    onChange={(e) =>
                                      updatePackageDraft({ ...pkg, description: e.target.value })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] resize-y"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-400">
                                    Características (una por línea)
                                  </label>
                                  <textarea
                                    rows={4}
                                    value={editingPkgFeaturesText}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditingPkgFeaturesText(val);
                                      updatePackageDraft({
                                        ...pkg,
                                        features: val
                                          .split('\n')
                                          .map((line) => line.trim())
                                          .filter(Boolean),
                                      });
                                    }}
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] resize-y"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMediaPickerTarget({ mode: 'package-image', packageId: pkg.id })
                                      }
                                      className="px-2 py-1 text-[10px] bg-white/10 hover:bg-white/20 rounded text-stone-200 cursor-pointer"
                                    >
                                      {pkg.imageUrl ? 'Cambiar imagen' : '+ Imagen opcional'}
                                    </button>
                                    {pkg.imageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => updatePackageDraft({ ...pkg, imageUrl: '' }, true)}
                                        className="px-2 py-1 text-[10px] text-red-300 hover:underline cursor-pointer"
                                      >
                                        Quitar
                                      </button>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void persistPackageNow(pkg);
                                      setEditingPkgId(null);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                                  >
                                    Guardar plan
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Services Grid Inline Editor */}
              {selectedElement.type === 'services-grid' && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg border border-amber-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Editar Servicios</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newSrv: ServiceItem = {
                          id: `srv_${Date.now()}`,
                          number: String(localServices.length + 1).padStart(2, '0'),
                          title: 'Nuevo Servicio',
                          description: 'Descripción del servicio y valor para el cliente.',
                          category: 'Diseño',
                          deliverables: ['Entregable 1', 'Entregable 2'],
                          visible: true,
                          order: localServices.length + 1,
                        };
                        updateServiceDraft(newSrv, true);
                        setEditingServiceId(newSrv.id);
                        setEditingServiceDeliverablesText((newSrv.deliverables || []).join('\n'));
                      }}
                      className="px-2 py-1 text-[11px] font-medium bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                    >
                      + Servicio
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDynamicEditor(selectedElement)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Abrir editor visual de servicios</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSplitDynamicBlock(selectedElement)}
                    className="w-full py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>Separar en tarjetas y textos libres</span>
                  </button>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    También puedes hacer clic directo sobre cualquier servicio en el lienzo para escribir, o separarlo en elementos independientes.
                  </p>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {localServices.map((srv) => {
                      const isExpanded = editingServiceId === srv.id;
                      return (
                        <div
                          key={srv.id}
                          className={`rounded-md border p-2 space-y-2 ${
                            isExpanded
                              ? 'bg-black/50 border-amber-500/50'
                              : 'bg-black/30 border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold text-white truncate">
                                {srv.number ? `${srv.number} · ` : ''}{srv.title}
                              </div>
                              {srv.category && (
                                <div className="text-[10px] text-stone-400 truncate">{srv.category}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                title={srv.visible ? 'Ocultar servicio' : 'Mostrar servicio'}
                                onClick={() => updateServiceDraft({ ...srv, visible: !srv.visible }, true)}
                                className="p-1 text-stone-400 hover:text-white rounded cursor-pointer"
                              >
                                {srv.visible ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExpanded) {
                                    setEditingServiceId(null);
                                  } else {
                                    setEditingServiceId(srv.id);
                                    setEditingServiceDeliverablesText((srv.deliverables || []).join('\n'));
                                  }
                                }}
                                className="px-2 py-0.5 text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white rounded cursor-pointer"
                              >
                                {isExpanded ? 'Listo' : 'Editar'}
                              </button>
                              <button
                                type="button"
                                title="Eliminar servicio"
                                onClick={() => {
                                  setLocalServices((prev) => prev.filter((x) => x.id !== srv.id));
                                  if (editingServiceId === srv.id) setEditingServiceId(null);
                                  void deleteDraftService(srv.id);
                                }}
                                className="p-1 text-stone-400 hover:text-red-400 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-2 pt-2 border-t border-white/10">
                              <div className="grid grid-cols-3 gap-1.5">
                                <div>
                                  <label className="text-[10px] text-stone-400">Número</label>
                                  <input
                                    type="text"
                                    value={srv.number || ''}
                                    onChange={(e) => updateServiceDraft({ ...srv, number: e.target.value })}
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-400">Categoría</label>
                                  <input
                                    type="text"
                                    value={srv.category || ''}
                                    onChange={(e) => updateServiceDraft({ ...srv, category: e.target.value })}
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-400">Orden</label>
                                  <input
                                    type="number"
                                    value={srv.order}
                                    onChange={(e) =>
                                      updateServiceDraft({ ...srv, order: Number(e.target.value) || 0 })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] tabular-nums"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400">Título del servicio</label>
                                <input
                                  type="text"
                                  value={srv.title}
                                  onChange={(e) => updateServiceDraft({ ...srv, title: e.target.value })}
                                  className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400">Descripción</label>
                                <textarea
                                  rows={2}
                                  value={srv.description}
                                  onChange={(e) => updateServiceDraft({ ...srv, description: e.target.value })}
                                  className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] resize-y"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400">
                                  Entregables (uno por línea)
                                </label>
                                <textarea
                                  rows={3}
                                  value={editingServiceDeliverablesText}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingServiceDeliverablesText(val);
                                    updateServiceDraft({
                                      ...srv,
                                      deliverables: val
                                        .split('\n')
                                        .map((line) => line.trim())
                                        .filter(Boolean),
                                    });
                                  }}
                                  className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] resize-y"
                                />
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void persistServiceNow(srv);
                                    setEditingServiceId(null);
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                                >
                                  Guardar servicio
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Testimonials Grid Inline Editor */}
              {selectedElement.type === 'testimonials-grid' && (
                <div className="space-y-3 p-3 bg-white/[0.03] rounded-lg border border-amber-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <MessageSquareQuote className="w-3.5 h-3.5" />
                      <span>Editar Testimonios</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newTest: TestimonialItem = {
                          id: `test_${Date.now()}`,
                          clientName: 'Nuevo Cliente',
                          clientRole: 'Directora',
                          company: 'Marca',
                          quote: 'Excelente resultado visual y atención en todo el proceso.',
                          resultMetric: 'Identidad completa',
                          avatarUrl: '',
                          visible: true,
                          order: localTestimonials.length + 1,
                        };
                        updateTestimonialDraft(newTest, true);
                        setEditingTestimonialId(newTest.id);
                      }}
                      className="px-2 py-1 text-[11px] font-medium bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                    >
                      + Testimonio
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDynamicEditor(selectedElement)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Abrir editor visual de testimonios</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSplitDynamicBlock(selectedElement)}
                    className="w-full py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>Separar en tarjetas y textos libres</span>
                  </button>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Haz clic directo en cada cita o cliente en la diapositiva para editar, o usa «Separar» para mover cada tarjeta libremente.
                  </p>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {localTestimonials.map((t) => {
                      const isExpanded = editingTestimonialId === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`rounded-md border p-2 space-y-2 ${
                            isExpanded
                              ? 'bg-black/50 border-amber-500/50'
                              : 'bg-black/30 border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold text-white truncate">
                                {t.clientName}
                              </div>
                              <div className="text-[10px] text-stone-400 truncate">
                                {[t.clientRole, t.company].filter(Boolean).join(' · ') || 'Cliente'}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                title={t.visible ? 'Ocultar testimonio' : 'Mostrar testimonio'}
                                onClick={() => updateTestimonialDraft({ ...t, visible: !t.visible }, true)}
                                className="p-1 text-stone-400 hover:text-white rounded cursor-pointer"
                              >
                                {t.visible ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTestimonialId(isExpanded ? null : t.id)}
                                className="px-2 py-0.5 text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white rounded cursor-pointer"
                              >
                                {isExpanded ? 'Listo' : 'Editar'}
                              </button>
                              <button
                                type="button"
                                title="Eliminar testimonio"
                                onClick={() => {
                                  setLocalTestimonials((prev) => prev.filter((x) => x.id !== t.id));
                                  if (editingTestimonialId === t.id) setEditingTestimonialId(null);
                                  void deleteDraftTestimonial(t.id);
                                }}
                                className="p-1 text-stone-400 hover:text-red-400 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-2 pt-2 border-t border-white/10">
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[10px] text-stone-400">Cliente</label>
                                  <input
                                    type="text"
                                    value={t.clientName}
                                    onChange={(e) =>
                                      updateTestimonialDraft({ ...t, clientName: e.target.value })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-400">Cargo</label>
                                  <input
                                    type="text"
                                    value={t.clientRole || ''}
                                    onChange={(e) =>
                                      updateTestimonialDraft({ ...t, clientRole: e.target.value })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[10px] text-stone-400">Empresa</label>
                                  <input
                                    type="text"
                                    value={t.company || ''}
                                    onChange={(e) =>
                                      updateTestimonialDraft({ ...t, company: e.target.value })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-400">Resultado destacado</label>
                                  <input
                                    type="text"
                                    value={t.resultMetric || ''}
                                    onChange={(e) =>
                                      updateTestimonialDraft({ ...t, resultMetric: e.target.value })
                                    }
                                    className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400">Testimonio</label>
                                <textarea
                                  rows={3}
                                  value={t.quote}
                                  onChange={(e) => updateTestimonialDraft({ ...t, quote: e.target.value })}
                                  className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px] resize-y"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMediaPickerTarget({
                                        mode: 'testimonial-avatar',
                                        testimonialId: t.id,
                                      })
                                    }
                                    className="px-2 py-1 text-[10px] bg-white/10 hover:bg-white/20 rounded text-stone-200 cursor-pointer"
                                  >
                                    {t.avatarUrl ? 'Cambiar foto' : '+ Foto cliente'}
                                  </button>
                                  {t.avatarUrl && (
                                    <button
                                      type="button"
                                      onClick={() => updateTestimonialDraft({ ...t, avatarUrl: '' }, true)}
                                      className="px-2 py-1 text-[10px] text-red-300 hover:underline cursor-pointer"
                                    >
                                      Quitar
                                    </button>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void persistTestimonialNow(t);
                                    setEditingTestimonialId(null);
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contact Block Inline Editor */}
              {selectedElement.type === 'contact-block' && (
                <div className="space-y-2.5 p-3 bg-white/[0.03] rounded-lg border border-amber-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Datos de Contacto</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void persistContactNow(localContact)}
                      className="px-2 py-1 text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDynamicEditor(selectedElement)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Abrir editor amplio de contacto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSplitDynamicBlock(selectedElement)}
                    className="w-full py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>Separar en botones y textos libres</span>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-400">WhatsApp</label>
                      <input
                        type="text"
                        placeholder="+58412..."
                        value={localContact.whatsappNumber}
                        onChange={(e) => updateContactDraft({ whatsappNumber: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400">Correo electrónico</label>
                      <input
                        type="email"
                        value={localContact.email}
                        onChange={(e) => updateContactDraft({ email: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400">Nombre profesional / Estudio</label>
                    <input
                      type="text"
                      value={localContact.professionalName}
                      onChange={(e) => updateContactDraft({ professionalName: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-400">Especialidad</label>
                      <input
                        type="text"
                        value={localContact.specialty}
                        onChange={(e) => updateContactDraft({ specialty: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400">Ubicación</label>
                      <input
                        type="text"
                        value={localContact.location}
                        onChange={(e) => updateContactDraft({ location: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400">Instagram URL</label>
                    <input
                      type="text"
                      placeholder="https://instagram.com/..."
                      value={localContact.instagramUrl}
                      onChange={(e) => updateContactDraft({ instagramUrl: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400">TikTok URL</label>
                    <input
                      type="text"
                      placeholder="https://tiktok.com/@..."
                      value={localContact.tiktokUrl}
                      onChange={(e) => updateContactDraft({ tiktokUrl: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400">Sitio Web URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={localContact.websiteUrl}
                      onChange={(e) => updateContactDraft({ websiteUrl: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-black/50 border border-white/15 rounded text-white text-[11px]"
                    />
                  </div>
                </div>
              )}

              {/* Typography Controls */}
              {(['heading', 'text', 'button', 'card'].includes(selectedElement.type)) && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="font-medium text-stone-200">Tipografía</div>
                  <select
                    value={selectedElement.style.fontFamily || ''}
                    onChange={(e) =>
                      handleUpdateElement(selectedElement.id, { style: { fontFamily: e.target.value || undefined } }, true)
                    }
                    className="w-full px-2 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                  >
                    <option value="">Heredar de Identidad Visual</option>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-400">Tamaño (px)</label>
                      <input
                        type="number"
                        min={10}
                        max={120}
                        value={selectedElement.style.fontSize || 16}
                        onChange={(e) =>
                          handleUpdateElement(selectedElement.id, { style: { fontSize: Number(e.target.value) } }, true)
                        }
                        className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400">Peso</label>
                      <select
                        value={String(selectedElement.style.fontWeight || 400)}
                        onChange={(e) =>
                          handleUpdateElement(selectedElement.id, { style: { fontWeight: Number(e.target.value) } }, true)
                        }
                        className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                      >
                        <option value="400">Regular</option>
                        <option value="500">Medium</option>
                        <option value="600">SemiBold</option>
                        <option value="700">Bold</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400">Alineación</label>
                      <select
                        value={selectedElement.style.textAlign || 'left'}
                        onChange={(e) =>
                          handleUpdateElement(
                            selectedElement.id,
                            { style: { textAlign: e.target.value as 'left' | 'center' | 'right' } },
                            true
                          )
                        }
                        className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                      >
                        <option value="left">Izquierda</option>
                        <option value="center">Centro</option>
                        <option value="right">Derecha</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Colors, Spacing & Opacity */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="font-medium text-stone-200">Color y Apariencia</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Color texto</label>
                    <input
                      type="color"
                      value={selectedElement.style.color || config.visualIdentity.textColor}
                      onChange={(e) =>
                        handleUpdateElement(selectedElement.id, { style: { color: e.target.value } }, true)
                      }
                      className="w-full h-8 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Color fondo</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={
                          selectedElement.style.backgroundColor &&
                          selectedElement.style.backgroundColor !== 'transparent'
                            ? selectedElement.style.backgroundColor
                            : '#FFFFFF'
                        }
                        onChange={(e) =>
                          handleUpdateElement(selectedElement.id, { style: { backgroundColor: e.target.value } }, true)
                        }
                        className="w-full h-8 rounded cursor-pointer bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateElement(selectedElement.id, { style: { backgroundColor: 'transparent' } }, true)
                        }
                        className="px-1.5 py-1 text-[10px] bg-white/10 rounded text-stone-300"
                      >
                        Sin
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-stone-400">
                      Opacidad ({Math.round((selectedElement.style.opacity ?? 1) * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={selectedElement.style.opacity ?? 1}
                      onChange={(e) =>
                        handleUpdateElement(selectedElement.id, { style: { opacity: Number(e.target.value) } }, true)
                      }
                      className="w-full mt-1.5 accent-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400">Radio borde (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={64}
                      value={selectedElement.style.borderRadius ?? 10}
                      onChange={(e) =>
                        handleUpdateElement(selectedElement.id, { style: { borderRadius: Number(e.target.value) } }, true)
                      }
                      className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-stone-400">Margen interno (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={64}
                      value={selectedElement.style.padding ?? 0}
                      onChange={(e) =>
                        handleUpdateElement(selectedElement.id, { style: { padding: Number(e.target.value) } }, true)
                      }
                      className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400">Sombra</label>
                    <select
                      value={selectedElement.style.shadow || 'none'}
                      onChange={(e) =>
                        handleUpdateElement(
                          selectedElement.id,
                          { style: { shadow: e.target.value as 'none' | 'sm' | 'md' | 'lg' } },
                          true
                        )
                      }
                      className="w-full mt-1 px-2 py-1 bg-black/40 border border-white/15 rounded text-white"
                    >
                      <option value="none">Ninguna</option>
                      <option value="sm">Sutil</option>
                      <option value="md">Media</option>
                      <option value="lg">Elevada</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Alignment & Geometry */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-200">Acomodar en lienzo</span>
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('fit-canvas')}
                    title="Llenar lienzo 1280×720"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Fondo 16:9</span>
                  </button>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('left')}
                    title="Alinear izquierda"
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowLeftToLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('center-h')}
                    title="Centrar horizontalmente"
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('right')}
                    title="Alinear derecha"
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowRightToLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('top')}
                    title="Alinear arriba"
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('center-v')}
                    title="Centrar verticalmente"
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedElement.locked}
                    onClick={() => alignSelectedElement('bottom')}
                    title="Alinear abajo"
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-stone-200 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMoveLayer(selectedElement.id, 'up')}
                    className="py-1 px-2 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] text-stone-200 inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>Traer adelante</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveLayer(selectedElement.id, 'down')}
                    className="py-1 px-2 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] text-stone-200 inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                    <span>Enviar atrás</span>
                  </button>
                </div>

                <div className="font-medium text-stone-200 pt-1">Posición y Dimensiones (1280×720)</div>
                <div className="grid grid-cols-4 gap-1.5 tabular-nums">
                  {(['x', 'y', 'w', 'h'] as const).map((prop) => (
                    <div key={prop}>
                      <label className="text-[10px] text-stone-400 uppercase">{prop}</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement[prop])}
                        onChange={(e) =>
                          handleUpdateElement(selectedElement.id, { [prop]: Number(e.target.value) }, true)
                        }
                        className="w-full mt-0.5 px-1.5 py-1 bg-black/40 border border-white/15 rounded text-white"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500">
                  Tip: Usa las flechas del teclado para mover 2px (Shift + flecha = 16px).
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5 text-xs">
              <div className="pb-3 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Propiedades de la Página</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Haz clic en cualquier elemento del lienzo para editarlo, o ajusta el fondo de esta página.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] text-stone-400">Título de la página</label>
                <input
                  type="text"
                  value={localPage.title}
                  onChange={(e) => commitPageChange({ ...localPage, title: e.target.value }, true)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] text-stone-400">Subtítulo</label>
                <input
                  type="text"
                  value={localPage.subtitle || ''}
                  onChange={(e) => commitPageChange({ ...localPage, subtitle: e.target.value }, true)}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-white"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="block text-[11px] text-stone-400">Color de fondo particular</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localPage.backgroundColor || config.visualIdentity.backgroundColor}
                    onChange={(e) => commitPageChange({ ...localPage, backgroundColor: e.target.value }, true)}
                    className="h-8 w-16 rounded cursor-pointer bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => commitPageChange({ ...localPage, backgroundColor: '' }, true)}
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded text-stone-200 cursor-pointer"
                  >
                    Usar global
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="block text-[11px] text-stone-400">Imagen de fondo (opcional)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget({ mode: 'page-bg' })}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-md text-white font-medium cursor-pointer"
                  >
                    Elegir fondo
                  </button>
                  {localPage.backgroundImage && (
                    <button
                      type="button"
                      onClick={() => commitPageChange({ ...localPage, backgroundImage: '' }, true)}
                      className="px-3 py-2 bg-red-950/60 text-red-200 rounded-md cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="block text-[11px] text-stone-400">
                  Popup al hacer clic en imágenes de esta página
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextEls = localPage.elements.map((el) => {
                        if (el.type === 'image') return { ...el, enablePopup: true };
                        if (el.type === 'gallery' && el.galleryItems) {
                          return {
                            ...el,
                            galleryItems: el.galleryItems.map((gi) => ({ ...gi, enablePopup: true })),
                          };
                        }
                        return el;
                      });
                      commitPageChange({ ...localPage, elements: nextEls }, true);
                    }}
                    className="py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/35 rounded-md text-emerald-200 text-[11px] font-medium cursor-pointer"
                  >
                    Activar en todas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextEls = localPage.elements.map((el) => {
                        if (el.type === 'image') return { ...el, enablePopup: false };
                        if (el.type === 'gallery' && el.galleryItems) {
                          return {
                            ...el,
                            galleryItems: el.galleryItems.map((gi) => ({ ...gi, enablePopup: false })),
                          };
                        }
                        return el;
                      });
                      commitPageChange({ ...localPage, elements: nextEls }, true);
                    }}
                    className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/15 rounded-md text-stone-300 text-[11px] font-medium cursor-pointer"
                  >
                    Desactivar todas
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={pages.length <= 1}
                  onClick={() => {
                    setAlsoDeletePublished(true);
                    setPageToDelete(localPage);
                  }}
                  className="w-full py-2 px-3 rounded-md bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-red-200 font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar esta página</span>
                </button>
                {pages.length <= 1 && (
                  <p className="text-[10px] text-stone-500 text-center">Debe quedar al menos 1 página activa.</p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Media Picker Modal */}
      {mediaPickerTarget && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-5xl h-[82vh] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
            <MediaLibraryView
              user={user}
              folders={mediaFolders}
              items={mediaItems}
              pickerMode={true}
              filterTypeDefault={mediaPickerTarget.mode === 'element-video' ? 'video' : 'all'}
              onClosePicker={() => setMediaPickerTarget(null)}
              onSelectMedia={(item) => {
                if (mediaPickerTarget.mode === 'page-bg') {
                  commitPageChange({ ...localPage, backgroundImage: item.url }, true);
                } else if (mediaPickerTarget.mode === 'element-image' && selectedElement) {
                  const hadMediaBefore = Boolean(selectedElement.mediaUrl);
                  handleUpdateElement(selectedElement.id, { mediaUrl: item.url }, true);
                  if (!hadMediaBefore) {
                    fitImageToNaturalRatio(selectedElement.id, item.url);
                  }
                } else if (mediaPickerTarget.mode === 'element-video' && selectedElement) {
                  handleUpdateElement(selectedElement.id, { mediaUrl: item.url }, true);
                } else if (mediaPickerTarget.mode === 'element-poster' && selectedElement) {
                  handleUpdateElement(selectedElement.id, { posterUrl: item.url }, true);
                } else if (mediaPickerTarget.mode === 'gallery-item' && selectedElement) {
                  const next = (selectedElement.galleryItems || []).map((g) => {
                    if (g.id !== mediaPickerTarget.itemId) return g;
                    if (item.mediaType === 'video') {
                      return { ...g, videoUrl: item.url, mediaType: 'video' as const };
                    }
                    return { ...g, url: item.url };
                  });
                  handleUpdateElement(selectedElement.id, { galleryItems: next }, true);
                } else if (mediaPickerTarget.mode === 'gallery-add' && selectedElement) {
                  const isVid = item.mediaType === 'video';
                  const nextItem: GalleryMediaItem = {
                    id: `gal_${Date.now()}`,
                    url: isVid ? '/assets/images/showcase_video_production_1794757025032.jpg' : item.url,
                    videoUrl: isVid ? item.url : undefined,
                    videoAction: isVid ? 'online' : undefined,
                    title: item.name,
                    category: item.category || 'Proyecto',
                    year: String(new Date().getFullYear()),
                    mediaType: isVid ? 'video' : 'image',
                  };
                  handleUpdateElement(
                    selectedElement.id,
                    { galleryItems: [...(selectedElement.galleryItems || []), nextItem] },
                    true
                  );
                } else if (mediaPickerTarget.mode === 'package-image') {
                  const targetPkg = localPackages.find((p) => p.id === mediaPickerTarget.packageId);
                  if (targetPkg) {
                    updatePackageDraft({ ...targetPkg, imageUrl: item.url }, true);
                  }
                } else if (mediaPickerTarget.mode === 'testimonial-avatar') {
                  const targetTest = localTestimonials.find(
                    (t) => t.id === mediaPickerTarget.testimonialId
                  );
                  if (targetTest) {
                    updateTestimonialDraft({ ...targetTest, avatarUrl: item.url }, true);
                  }
                }
                setMediaPickerTarget(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6"
          onClick={() => {
            setPreviewLightboxItem(null);
            setShowPreviewModal(false);
          }}
        >
          <div className="w-full max-w-6xl flex items-center justify-between mb-3 text-white">
            <span className="text-sm font-medium">Vista previa · {localPage.title}</span>
            <button
              type="button"
              onClick={() => {
                setPreviewLightboxItem(null);
                setShowPreviewModal(false);
              }}
              className="p-2 hover:bg-white/10 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="w-full max-w-6xl aspect-video rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SlideRenderer
              page={localPage}
              identity={config.visualIdentity}
              contact={localContact}
              services={localServices}
              packages={localPackages}
              testimonials={localTestimonials}
              onOpenLightbox={(item) => setPreviewLightboxItem(item)}
            />
          </div>
        </div>
      )}

      {previewLightboxItem && (
        <MediaLightboxModal
          item={previewLightboxItem}
          identity={config.visualIdentity}
          onClose={() => setPreviewLightboxItem(null)}
        />
      )}

      {/* Create Page Modal */}
      {showCreatePageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePageInEditor}
            className="max-w-md w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-white">Crear nueva página 16:9</h3>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-400">Título de la página</label>
              <input
                type="text"
                required
                autoFocus
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="Ej. 17. Reels y Videos"
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={creatingPage}
                onClick={() => setShowCreatePageModal(false)}
                className="px-4 py-2 text-xs text-stone-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creatingPage}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer disabled:opacity-60"
              >
                {creatingPage ? 'Creando...' : 'Crear y editar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete Page Modal */}
      {pageToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Eliminar página</h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              ¿Confirmas que deseas eliminar <strong className="text-white">{pageToDelete.title}</strong>? Se perderán los elementos de esta página.
            </p>
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoDeletePublished}
                onChange={(e) => setAlsoDeletePublished(e.target.checked)}
                className="rounded accent-red-500"
              />
              <span>Quitar también del sitio público actual</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingPage}
                onClick={() => setPageToDelete(null)}
                className="px-4 py-2 text-xs text-stone-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingPage}
                onClick={() => void handleConfirmDeletePage()}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer disabled:opacity-60"
              >
                {deletingPage ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Visual Content Editor Modal (Planes, Servicios, Testimonios, Contacto) */}
      {dynamicEditModal && (() => {
        const modalEl = localPage.elements.find((e) => e.id === dynamicEditModal.elementId) || selectedElement;
        if (!modalEl) return null;

        const closeAndFlush = () => {
          void flushAutoSave();
          setDynamicEditModal(null);
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onClick={closeAndFlush}
          >
            <div
              className="w-full max-w-6xl max-h-[90vh] bg-[#16171B] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-white/10 bg-[#1B1D22] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/35 text-amber-300 flex items-center justify-center shrink-0">
                    {dynamicEditModal.type === 'packages-grid' ? (
                      <CreditCard className="w-4 h-4" />
                    ) : dynamicEditModal.type === 'services-grid' ? (
                      <Briefcase className="w-4 h-4" />
                    ) : dynamicEditModal.type === 'testimonials-grid' ? (
                      <MessageSquareQuote className="w-4 h-4" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                      {dynamicEditModal.type === 'packages-grid'
                        ? 'Editar Planes y Precios'
                        : dynamicEditModal.type === 'services-grid'
                        ? 'Editar Servicios'
                        : dynamicEditModal.type === 'testimonials-grid'
                        ? 'Editar Testimonios'
                        : 'Editar Datos de Contacto'}
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Todos los cambios se reflejan al instante en tu diapositiva y se guardan en tu borrador.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {dynamicEditModal.type === 'packages-grid' && (
                    <button
                      type="button"
                      onClick={() => {
                        const cat = modalEl.packageCategory || 'branding';
                        const newPkg: PackageItem = {
                          id: `pkg_${Date.now()}`,
                          category: cat,
                          name: 'Nuevo Plan',
                          description: 'Descripción breve del paquete.',
                          price: '',
                          currency: 'USD',
                          billingPeriod: 'Pago único',
                          imageUrl: '',
                          features: ['Entregable principal incluido', 'Asesoría personalizada'],
                          promoLabel: '',
                          isPopular: false,
                          visible: true,
                          order: localPackages.length + 1,
                        };
                        updatePackageDraft(newPkg, true);
                        setDynamicEditModal({ ...dynamicEditModal, focusItemId: newPkg.id });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar plan</span>
                    </button>
                  )}
                  {dynamicEditModal.type === 'services-grid' && (
                    <button
                      type="button"
                      onClick={() => {
                        const newSrv: ServiceItem = {
                          id: `srv_${Date.now()}`,
                          number: String(localServices.length + 1).padStart(2, '0'),
                          title: 'Nuevo Servicio',
                          description: 'Descripción breve del servicio.',
                          category: 'Diseño',
                          deliverables: ['Entregable 1', 'Entregable 2'],
                          visible: true,
                          order: localServices.length + 1,
                        };
                        updateServiceDraft(newSrv, true);
                        setDynamicEditModal({ ...dynamicEditModal, focusItemId: newSrv.id });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar servicio</span>
                    </button>
                  )}
                  {dynamicEditModal.type === 'testimonials-grid' && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTest: TestimonialItem = {
                          id: `test_${Date.now()}`,
                          clientName: 'Nuevo Cliente',
                          clientRole: 'Directora',
                          company: 'Empresa',
                          quote: 'Excelente resultado visual y acompañamiento profesional.',
                          resultMetric: 'Identidad completa',
                          avatarUrl: '',
                          visible: true,
                          order: localTestimonials.length + 1,
                        };
                        updateTestimonialDraft(newTest, true);
                        setDynamicEditModal({ ...dynamicEditModal, focusItemId: newTest.id });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar testimonio</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSplitDynamicBlock(modalEl)}
                    title="Convierte este bloque en tarjetas, textos y botones independientes para mover y diseñar libremente"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-xs font-medium cursor-pointer"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>Separar en bloques libres</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeAndFlush}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar y cerrar</span>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {dynamicEditModal.type === 'packages-grid' && (() => {
                  const activeCategory = modalEl.packageCategory || 'branding';
                  const categoryPackages = localPackages.filter((p) => p.category === activeCategory);

                  return (
                    <>
                      {/* Block-level settings bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10">
                        <div>
                          <label className="text-[11px] font-medium text-stone-400 block mb-1">
                            Categoría de planes mostrada en esta página
                          </label>
                          <select
                            value={activeCategory}
                            onChange={(e) =>
                              handleUpdateElement(
                                modalEl.id,
                                { packageCategory: e.target.value as PackageItem['category'] },
                                true
                              )
                            }
                            className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                          >
                            <option value="branding">Identidad Visual (Branding)</option>
                            <option value="social">Diseño para Redes Sociales</option>
                            <option value="video">Edición de Video</option>
                            <option value="custom">Personalizado</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-stone-400 block mb-1">
                            Texto del botón inferior en las tarjetas
                          </label>
                          <input
                            type="text"
                            placeholder="Solicitar plan"
                            value={modalEl.content || ''}
                            onChange={(e) =>
                              handleUpdateElement(modalEl.id, { content: e.target.value }, true)
                            }
                            className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>

                      {categoryPackages.length === 0 ? (
                        <div className="p-10 text-center rounded-xl border border-dashed border-white/15 text-sm text-stone-400">
                          No hay planes en esta categoría. Usa el botón <strong className="text-white">+ Agregar plan</strong> arriba para crear el primero.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {categoryPackages.map((pkg) => {
                            const isFocused = dynamicEditModal.focusItemId === pkg.id;
                            return (
                              <div
                                key={pkg.id}
                                className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                                  isFocused
                                    ? 'bg-[#1D1F25] border-amber-500/70 ring-1 ring-amber-500/40'
                                    : 'bg-[#1A1C21] border-white/10'
                                }`}
                              >
                                {/* Card Top Controls */}
                                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                                  <button
                                    type="button"
                                    onClick={() => updatePackageDraft({ ...pkg, isPopular: !pkg.isPopular }, true)}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                                      pkg.isPopular
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-white/5 text-stone-400 hover:text-white'
                                    }`}
                                  >
                                    <Star className={`w-3 h-3 ${pkg.isPopular ? 'fill-amber-300' : ''}`} />
                                    <span>{pkg.isPopular ? 'Más Popular' : 'Destacar'}</span>
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      title={pkg.visible ? 'Ocultar plan' : 'Mostrar plan'}
                                      onClick={() => updatePackageDraft({ ...pkg, visible: !pkg.visible }, true)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] cursor-pointer ${
                                        pkg.visible
                                          ? 'bg-emerald-500/15 text-emerald-300'
                                          : 'bg-white/5 text-stone-400'
                                      }`}
                                    >
                                      {pkg.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                      <span>{pkg.visible ? 'Visible' : 'Oculto'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Eliminar plan"
                                      onClick={() => {
                                        setLocalPackages((prev) => prev.filter((x) => x.id !== pkg.id));
                                        if (editingPkgId === pkg.id) setEditingPkgId(null);
                                        void deleteDraftPackage(pkg.id);
                                      }}
                                      className="p-1.5 rounded-md text-stone-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Plan Title */}
                                <div>
                                  <label className="text-[10px] uppercase tracking-wider text-stone-400">
                                    Nombre del plan
                                  </label>
                                  <input
                                    type="text"
                                    value={pkg.name}
                                    onChange={(e) => updatePackageDraft({ ...pkg, name: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                                  />
                                </div>

                                {/* Price, Currency, Period */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] text-stone-400">Precio</label>
                                    <input
                                      type="text"
                                      placeholder="A consultar"
                                      value={pkg.price || ''}
                                      onChange={(e) => updatePackageDraft({ ...pkg, price: e.target.value })}
                                      className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white tabular-nums"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-400">Moneda</label>
                                    <input
                                      type="text"
                                      placeholder="USD / $"
                                      value={pkg.currency}
                                      onChange={(e) => updatePackageDraft({ ...pkg, currency: e.target.value })}
                                      className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-400">Ciclo</label>
                                    <input
                                      type="text"
                                      placeholder="Pago único"
                                      value={pkg.billingPeriod || ''}
                                      onChange={(e) => updatePackageDraft({ ...pkg, billingPeriod: e.target.value })}
                                      className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                                    />
                                  </div>
                                </div>

                                {/* Promo Label & Order */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="col-span-2">
                                    <label className="text-[10px] text-stone-400">Etiqueta superior (opcional)</label>
                                    <input
                                      type="text"
                                      placeholder="Ej. Más Popular"
                                      value={pkg.promoLabel || ''}
                                      onChange={(e) => updatePackageDraft({ ...pkg, promoLabel: e.target.value })}
                                      className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-400">Orden</label>
                                    <input
                                      type="number"
                                      value={pkg.order}
                                      onChange={(e) =>
                                        updatePackageDraft({ ...pkg, order: Number(e.target.value) || 0 })
                                      }
                                      className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white tabular-nums"
                                    />
                                  </div>
                                </div>

                                {/* Description */}
                                <div>
                                  <label className="text-[10px] text-stone-400">Descripción breve</label>
                                  <textarea
                                    rows={2}
                                    value={pkg.description || ''}
                                    onChange={(e) => updatePackageDraft({ ...pkg, description: e.target.value })}
                                    className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white resize-y"
                                  />
                                </div>

                                {/* Individual Feature Items */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-stone-400">
                                      Qué incluye ({(pkg.features || []).length})
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updatePackageDraft(
                                          { ...pkg, features: [...(pkg.features || []), 'Nuevo entregable'] },
                                          true
                                        )
                                      }
                                      className="text-[11px] font-medium text-amber-400 hover:text-amber-300 cursor-pointer"
                                    >
                                      + Agregar punto
                                    </button>
                                  </div>
                                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                    {(pkg.features || []).map((feat, fIdx) => (
                                      <div key={fIdx} className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          value={feat}
                                          onChange={(e) => {
                                            const nextFeats = [...(pkg.features || [])];
                                            nextFeats[fIdx] = e.target.value;
                                            updatePackageDraft({ ...pkg, features: nextFeats });
                                          }}
                                          className="flex-1 px-2.5 py-1 bg-black/50 border border-white/10 rounded text-xs text-stone-100"
                                        />
                                        <button
                                          type="button"
                                          title="Quitar punto"
                                          onClick={() => {
                                            const nextFeats = (pkg.features || []).filter((_, i) => i !== fIdx);
                                            updatePackageDraft({ ...pkg, features: nextFeats }, true);
                                          }}
                                          className="p-1 text-stone-500 hover:text-red-400 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Optional Image */}
                                <div className="pt-2 mt-auto border-t border-white/10 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMediaPickerTarget({ mode: 'package-image', packageId: pkg.id })
                                    }
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-stone-200 cursor-pointer"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>{pkg.imageUrl ? 'Cambiar imagen' : 'Imagen opcional'}</span>
                                  </button>
                                  {pkg.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => updatePackageDraft({ ...pkg, imageUrl: '' }, true)}
                                      className="text-xs text-red-300 hover:underline cursor-pointer"
                                    >
                                      Quitar imagen
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}

                {dynamicEditModal.type === 'services-grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {localServices.map((srv) => {
                      const isFocused = dynamicEditModal.focusItemId === srv.id;
                      return (
                        <div
                          key={srv.id}
                          className={`rounded-xl border p-4 space-y-3 ${
                            isFocused
                              ? 'bg-[#1D1F25] border-amber-500/70 ring-1 ring-amber-500/40'
                              : 'bg-[#1A1C21] border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                            <span className="text-xs font-mono text-amber-300 font-semibold">
                              #{srv.number || srv.order}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateServiceDraft({ ...srv, visible: !srv.visible }, true)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer ${
                                  srv.visible ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-stone-400'
                                }`}
                              >
                                {srv.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <span>{srv.visible ? 'Visible' : 'Oculto'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalServices((prev) => prev.filter((x) => x.id !== srv.id));
                                  void deleteDraftService(srv.id);
                                }}
                                className="p-1.5 text-stone-400 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-stone-400">Número</label>
                              <input
                                type="text"
                                value={srv.number || ''}
                                onChange={(e) => updateServiceDraft({ ...srv, number: e.target.value })}
                                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-stone-400">Categoría</label>
                              <input
                                type="text"
                                value={srv.category || ''}
                                onChange={(e) => updateServiceDraft({ ...srv, category: e.target.value })}
                                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-stone-400">Título del servicio</label>
                            <input
                              type="text"
                              value={srv.title}
                              onChange={(e) => updateServiceDraft({ ...srv, title: e.target.value })}
                              className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-sm font-semibold text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-stone-400">Descripción</label>
                            <textarea
                              rows={3}
                              value={srv.description}
                              onChange={(e) => updateServiceDraft({ ...srv, description: e.target.value })}
                              className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white resize-y"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-stone-400">Entregables (separados por coma)</label>
                            <input
                              type="text"
                              value={(srv.deliverables || []).join(', ')}
                              onChange={(e) =>
                                updateServiceDraft({
                                  ...srv,
                                  deliverables: e.target.value
                                    .split(',')
                                    .map((x) => x.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {dynamicEditModal.type === 'testimonials-grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {localTestimonials.map((t) => {
                      const isFocused = dynamicEditModal.focusItemId === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`rounded-xl border p-4 space-y-3 ${
                            isFocused
                              ? 'bg-[#1D1F25] border-amber-500/70 ring-1 ring-amber-500/40'
                              : 'bg-[#1A1C21] border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                            <span className="text-xs font-semibold text-white truncate">{t.clientName}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateTestimonialDraft({ ...t, visible: !t.visible }, true)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer ${
                                  t.visible ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-stone-400'
                                }`}
                              >
                                {t.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <span>{t.visible ? 'Visible' : 'Oculto'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalTestimonials((prev) => prev.filter((x) => x.id !== t.id));
                                  void deleteDraftTestimonial(t.id);
                                }}
                                className="p-1.5 text-stone-400 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-stone-400">Nombre del cliente</label>
                              <input
                                type="text"
                                value={t.clientName}
                                onChange={(e) => updateTestimonialDraft({ ...t, clientName: e.target.value })}
                                className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400">Métrica / Resultado</label>
                              <input
                                type="text"
                                value={t.resultMetric || ''}
                                onChange={(e) => updateTestimonialDraft({ ...t, resultMetric: e.target.value })}
                                className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-stone-400">Cargo / Rol</label>
                              <input
                                type="text"
                                value={t.clientRole || ''}
                                onChange={(e) => updateTestimonialDraft({ ...t, clientRole: e.target.value })}
                                className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400">Empresa</label>
                              <input
                                type="text"
                                value={t.company || ''}
                                onChange={(e) => updateTestimonialDraft({ ...t, company: e.target.value })}
                                className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-stone-400">Testimonio / Cita</label>
                            <textarea
                              rows={3}
                              value={t.quote}
                              onChange={(e) => updateTestimonialDraft({ ...t, quote: e.target.value })}
                              className="w-full mt-1 px-2.5 py-1.5 bg-black/50 border border-white/15 rounded-lg text-xs text-white resize-y"
                            />
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setMediaPickerTarget({ mode: 'testimonial-avatar', testimonialId: t.id })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-stone-200 cursor-pointer"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{t.avatarUrl ? 'Cambiar foto' : 'Elegir foto'}</span>
                            </button>
                            {t.avatarUrl && (
                              <button
                                type="button"
                                onClick={() => updateTestimonialDraft({ ...t, avatarUrl: '' }, true)}
                                className="text-xs text-red-300 hover:underline cursor-pointer"
                              >
                                Quitar foto
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {dynamicEditModal.type === 'contact-block' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    <div>
                      <label className="text-xs text-stone-400">Nombre profesional</label>
                      <input
                        type="text"
                        value={localContact.professionalName}
                        onChange={(e) => updateContactDraft({ professionalName: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Nombre comercial / Estudio</label>
                      <input
                        type="text"
                        value={localContact.studioName}
                        onChange={(e) => updateContactDraft({ studioName: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Especialidad</label>
                      <input
                        type="text"
                        value={localContact.specialty}
                        onChange={(e) => updateContactDraft({ specialty: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Ubicación / Cobertura</label>
                      <input
                        type="text"
                        value={localContact.location}
                        onChange={(e) => updateContactDraft({ location: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">WhatsApp (con código de país)</label>
                      <input
                        type="text"
                        value={localContact.whatsappNumber}
                        onChange={(e) => updateContactDraft({ whatsappNumber: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Correo electrónico</label>
                      <input
                        type="email"
                        value={localContact.email}
                        onChange={(e) => updateContactDraft({ email: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-stone-400">Mensaje predeterminado de WhatsApp</label>
                      <input
                        type="text"
                        value={localContact.whatsappDefaultMessage}
                        onChange={(e) => updateContactDraft({ whatsappDefaultMessage: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Instagram URL</label>
                      <input
                        type="url"
                        value={localContact.instagramUrl}
                        onChange={(e) => updateContactDraft({ instagramUrl: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Facebook URL</label>
                      <input
                        type="url"
                        value={localContact.facebookUrl}
                        onChange={(e) => updateContactDraft({ facebookUrl: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">TikTok URL</label>
                      <input
                        type="url"
                        value={localContact.tiktokUrl}
                        onChange={(e) => updateContactDraft({ tiktokUrl: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400">Sitio Web URL</label>
                      <input
                        type="url"
                        value={localContact.websiteUrl}
                        onChange={(e) => updateContactDraft({ websiteUrl: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Persistent Hidden Direct Image Upload Input (for images, logos & video covers) */}
      <input
        ref={directUploadRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif"
        className="hidden"
        onChange={(e) => {
          void handleDirectUploadForSelected(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
};
