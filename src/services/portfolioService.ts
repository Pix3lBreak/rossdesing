import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../config/firebase';
import {
  DEFAULT_CONTACT,
  DEFAULT_MEDIA_FOLDERS,
  DEFAULT_MEDIA_ITEMS,
  DEFAULT_PACKAGES,
  DEFAULT_PAGES,
  DEFAULT_PORTFOLIO_CONFIG,
  DEFAULT_SERVICES,
  DEFAULT_TESTIMONIALS,
  DEFAULT_VISUAL_IDENTITY,
} from '../data/defaultPortfolio';
import type {
  PackageItem,
  PortfolioConfig,
  PortfolioPage,
  PortfolioSnapshot,
  PortfolioVersion,
  ServiceItem,
  TestimonialItem,
} from '../types/portfolio';

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== undefined) {
          out[k] = stripUndefined(v);
        }
      }
      return out as T;
    }
  }
  return value;
}

function sanitizePagePayload(page: PortfolioPage) {
  return stripUndefined({
    id: page.id,
    order: Math.max(0, Math.min(500, Math.round(page.order))),
    slug: (page.slug || page.id).slice(0, 100),
    title: (page.title || 'Sin título').slice(0, 140),
    subtitle: (page.subtitle || '').slice(0, 240),
    templateType: (page.templateType || 'custom').slice(0, 64),
    visible: Boolean(page.visible),
    backgroundColor: (page.backgroundColor || '').slice(0, 40),
    backgroundGradient: (page.backgroundGradient || '').slice(0, 300),
    backgroundImage: (page.backgroundImage || '').slice(0, 1000),
    accentColorOverride: (page.accentColorOverride || '').slice(0, 40),
    elements: (page.elements || []).slice(0, 100),
  });
}

function sanitizeConfigPayload(config: PortfolioConfig) {
  return stripUndefined({
    studioName: (config.studioName || 'PORTFOLIO STUDIO PRO').slice(0, 120),
    studioTagline: (config.studioTagline || '').slice(0, 200),
    seoDescription: (config.seoDescription || '').slice(0, 400),
    publicSlug: (config.publicSlug || 'portafolio').slice(0, 100),
    allowPublicPdfExport: Boolean(config.allowPublicPdfExport ?? true),
    visualIdentity: config.visualIdentity,
    contact: config.contact,
    hasUnpublishedChanges: Boolean(config.hasUnpublishedChanges),
    ...(config.lastPublishedVersionId
      ? { lastPublishedVersionId: config.lastPublishedVersionId.slice(0, 128) }
      : {}),
  });
}

export interface PortfolioBundle {
  config: PortfolioConfig;
  pages: PortfolioPage[];
  services: ServiceItem[];
  packages: PackageItem[];
  testimonials: TestimonialItem[];
  isFromFirestore: boolean;
}

export function subscribePublishedPortfolio(
  onData: (bundle: PortfolioBundle) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let config: PortfolioConfig | null = null;
  let pages: PortfolioPage[] = [];
  let services: ServiceItem[] = [];
  let packages: PackageItem[] = [];
  let testimonials: TestimonialItem[] = [];
  let initialized = { config: false, pages: false, services: false, packages: false, testimonials: false };

  const mergeConfig = (raw: PortfolioConfig | null): PortfolioConfig => {
    if (!raw) return DEFAULT_PORTFOLIO_CONFIG;
    return {
      ...DEFAULT_PORTFOLIO_CONFIG,
      ...raw,
      visualIdentity: { ...DEFAULT_VISUAL_IDENTITY, ...(raw.visualIdentity || {}) },
      contact: { ...DEFAULT_CONTACT, ...(raw.contact || {}) },
    };
  };

  const emit = () => {
    if (!initialized.config || !initialized.pages) return;
    const hasCloud = pages.length > 0 && config !== null;
    onData({
      config: mergeConfig(config),
      pages: hasCloud ? [...pages].sort((a, b) => a.order - b.order) : DEFAULT_PAGES,
      services: services.length > 0 ? [...services].sort((a, b) => a.order - b.order) : DEFAULT_SERVICES,
      packages: packages.length > 0 ? [...packages].sort((a, b) => a.order - b.order) : DEFAULT_PACKAGES,
      testimonials: testimonials.length > 0 ? [...testimonials].sort((a, b) => a.order - b.order) : DEFAULT_TESTIMONIALS,
      isFromFirestore: hasCloud,
    });
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'published_portfolio', 'main'),
      (snap) => {
        config = snap.exists() ? (snap.data() as PortfolioConfig) : null;
        initialized.config = true;
        emit();
      },
      (err) => {
        if (onError) onError(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'published_pages'), orderBy('order', 'asc')),
      (snap) => {
        pages = snap.docs.map((d) => d.data() as PortfolioPage);
        initialized.pages = true;
        emit();
      },
      (err) => {
        if (onError) onError(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'published_services'), orderBy('order', 'asc')),
      (snap) => {
        services = snap.docs.map((d) => d.data() as ServiceItem);
        initialized.services = true;
        emit();
      },
      (err) => {
        if (onError) onError(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'published_packages'), orderBy('order', 'asc')),
      (snap) => {
        packages = snap.docs.map((d) => d.data() as PackageItem);
        initialized.packages = true;
        emit();
      },
      (err) => {
        if (onError) onError(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'published_testimonials'), orderBy('order', 'asc')),
      (snap) => {
        testimonials = snap.docs.map((d) => d.data() as TestimonialItem);
        initialized.testimonials = true;
        emit();
      },
      (err) => {
        if (onError) onError(err);
      }
    )
  );

  return () => unsubs.forEach((u) => u());
}

export function subscribeDraftPortfolio(
  onData: (bundle: PortfolioBundle) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let config: PortfolioConfig = DEFAULT_PORTFOLIO_CONFIG;
  let pages: PortfolioPage[] = [];
  let services: ServiceItem[] = [];
  let packages: PackageItem[] = [];
  let testimonials: TestimonialItem[] = [];
  let loaded = { config: false, pages: false };

  const emit = () => {
    if (!loaded.config || !loaded.pages) return;
    onData({
      config,
      pages: [...pages].sort((a, b) => a.order - b.order),
      services: [...services].sort((a, b) => a.order - b.order),
      packages: [...packages].sort((a, b) => a.order - b.order),
      testimonials: [...testimonials].sort((a, b) => a.order - b.order),
      isFromFirestore: pages.length > 0,
    });
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'draft_portfolio', 'main'),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as PortfolioConfig;
          config = {
            ...DEFAULT_PORTFOLIO_CONFIG,
            ...raw,
            visualIdentity: { ...DEFAULT_VISUAL_IDENTITY, ...(raw.visualIdentity || {}) },
            contact: { ...DEFAULT_CONTACT, ...(raw.contact || {}) },
          };
        }
        loaded.config = true;
        emit();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, 'draft_portfolio/main');
        } catch (wrapped) {
          onError?.(wrapped as Error);
        }
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'draft_pages'), orderBy('order', 'asc')),
      (snap) => {
        pages = snap.docs.map((d) => d.data() as PortfolioPage);
        loaded.pages = true;
        emit();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'draft_pages');
        } catch (wrapped) {
          onError?.(wrapped as Error);
        }
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'draft_services'), orderBy('order', 'asc')),
      (snap) => {
        services = snap.docs.map((d) => d.data() as ServiceItem);
        emit();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'draft_services');
        } catch (wrapped) {
          onError?.(wrapped as Error);
        }
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'draft_packages'), orderBy('order', 'asc')),
      (snap) => {
        packages = snap.docs.map((d) => d.data() as PackageItem);
        emit();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'draft_packages');
        } catch (wrapped) {
          onError?.(wrapped as Error);
        }
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'draft_testimonials'), orderBy('order', 'asc')),
      (snap) => {
        testimonials = snap.docs.map((d) => d.data() as TestimonialItem);
        emit();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'draft_testimonials');
        } catch (wrapped) {
          onError?.(wrapped as Error);
        }
      }
    )
  );

  return () => unsubs.forEach((u) => u());
}

function sanitizeServicePayload(srv: ServiceItem) {
  return stripUndefined({
    number: (srv.number || '').slice(0, 16),
    title: srv.title.slice(0, 120),
    description: srv.description.slice(0, 600),
    category: (srv.category || '').slice(0, 80),
    deliverables: (srv.deliverables || []).slice(0, 20),
    visible: Boolean(srv.visible),
    order: Math.max(0, Math.min(500, Math.round(srv.order))),
  });
}

function sanitizePackagePayload(pkg: PackageItem) {
  return stripUndefined({
    category: pkg.category,
    name: pkg.name.slice(0, 120),
    description: (pkg.description || '').slice(0, 500),
    price: (pkg.price || '').slice(0, 60),
    currency: (pkg.currency || 'USD').slice(0, 12),
    billingPeriod: (pkg.billingPeriod || '').slice(0, 60),
    imageUrl: (pkg.imageUrl || '').slice(0, 1000),
    features: (pkg.features || []).slice(0, 30),
    promoLabel: (pkg.promoLabel || '').slice(0, 60),
    isPopular: Boolean(pkg.isPopular),
    visible: Boolean(pkg.visible),
    order: Math.max(0, Math.min(500, Math.round(pkg.order))),
  });
}

function sanitizeTestimonialPayload(item: TestimonialItem) {
  return stripUndefined({
    clientName: item.clientName.slice(0, 120),
    clientRole: (item.clientRole || '').slice(0, 120),
    company: (item.company || '').slice(0, 120),
    quote: item.quote.slice(0, 800),
    resultMetric: (item.resultMetric || '').slice(0, 120),
    avatarUrl: (item.avatarUrl || '').slice(0, 1000),
    visible: Boolean(item.visible),
    order: Math.max(0, Math.min(500, Math.round(item.order))),
  });
}

const ALLOWED_CONFIG_KEYS = new Set([
  'studioName', 'studioTagline', 'seoDescription', 'publicSlug',
  'allowPublicPdfExport', 'visualIdentity', 'contact',
  'hasUnpublishedChanges', 'lastPublishedVersionId', 'ownerUid', 'createdAt', 'updatedAt',
]);

const ALLOWED_PAGE_KEYS = new Set([
  'id', 'order', 'slug', 'title', 'subtitle', 'templateType',
  'visible', 'backgroundColor', 'backgroundGradient', 'backgroundImage', 'accentColorOverride',
  'elements', 'ownerUid', 'createdAt', 'updatedAt',
]);

const ALLOWED_SERVICE_KEYS = new Set([
  'id', 'number', 'title', 'description', 'category',
  'deliverables', 'visible', 'order', 'ownerUid', 'createdAt', 'updatedAt',
]);

const ALLOWED_PACKAGE_KEYS = new Set([
  'id', 'category', 'name', 'description', 'price', 'currency',
  'billingPeriod', 'imageUrl', 'features', 'promoLabel', 'isPopular',
  'visible', 'order', 'ownerUid', 'createdAt', 'updatedAt',
]);

const ALLOWED_TESTIMONIAL_KEYS = new Set([
  'id', 'clientName', 'clientRole', 'company', 'quote',
  'resultMetric', 'avatarUrl', 'visible', 'order', 'ownerUid', 'createdAt', 'updatedAt',
]);

function canSafelyUpdate(data: Record<string, unknown> | undefined, allowedKeys?: Set<string>): boolean {
  if (!data || typeof data.ownerUid !== 'string' || data.ownerUid.length === 0) return false;
  if (data.createdAt === undefined || data.createdAt === null) return false;
  if (allowedKeys) {
    return Object.keys(data).every((k) => allowedKeys.has(k));
  }
  return true;
}

export async function applyBrandTemplateToDraft(user: User, alsoPublish = false): Promise<void> {
  try {
    const now = serverTimestamp();
    const baseConfig = sanitizeConfigPayload({
      ...DEFAULT_PORTFOLIO_CONFIG,
      hasUnpublishedChanges: !alsoPublish,
    });

    const draftCfgRef = doc(db, 'draft_portfolio', 'main');
    const draftCfgSnap = await getDoc(draftCfgRef);
    if (draftCfgSnap.exists() && !canSafelyUpdate(draftCfgSnap.data() as Record<string, unknown>, ALLOWED_CONFIG_KEYS)) {
      await deleteDoc(draftCfgRef);
    }

    if (alsoPublish) {
      const pubCfgRef = doc(db, 'published_portfolio', 'main');
      const pubCfgSnap = await getDoc(pubCfgRef);
      if (pubCfgSnap.exists() && !canSafelyUpdate(pubCfgSnap.data() as Record<string, unknown>, ALLOWED_CONFIG_KEYS)) {
        await deleteDoc(pubCfgRef);
      }
    }

    // Batch 1: Configs & Pages
    const batch1 = writeBatch(db);
    const freshDraftCfg = await getDoc(draftCfgRef);
    if (freshDraftCfg.exists()) {
      batch1.update(draftCfgRef, { ...baseConfig, updatedAt: now });
    } else {
      batch1.set(draftCfgRef, { ...baseConfig, ownerUid: user.uid, createdAt: now, updatedAt: now });
    }

    if (alsoPublish) {
      const pubCfgRef = doc(db, 'published_portfolio', 'main');
      const freshPubCfg = await getDoc(pubCfgRef);
      if (freshPubCfg.exists()) {
        batch1.update(pubCfgRef, { ...baseConfig, updatedAt: now });
      } else {
        batch1.set(pubCfgRef, { ...baseConfig, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
    }

    const existingDraftPages = await getDocs(collection(db, 'draft_pages'));
    const existingDraftPageMap = new Map(existingDraftPages.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const existingPubPageMap = alsoPublish
      ? new Map((await getDocs(collection(db, 'published_pages'))).docs.map((d) => [d.id, d.data() as Record<string, unknown>]))
      : new Map<string, Record<string, unknown>>();

    for (const page of DEFAULT_PAGES) {
      const sanitized = sanitizePagePayload(page);
      const { id: _id, ...updateData } = sanitized;
      const ref = doc(db, 'draft_pages', page.id);
      if (canSafelyUpdate(existingDraftPageMap.get(page.id), ALLOWED_PAGE_KEYS)) {
        batch1.update(ref, { ...updateData, updatedAt: now });
      } else {
        if (existingDraftPageMap.has(page.id)) await deleteDoc(ref);
        batch1.set(ref, { ...sanitized, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
      if (alsoPublish) {
        const pubRef = doc(db, 'published_pages', page.id);
        if (canSafelyUpdate(existingPubPageMap.get(page.id), ALLOWED_PAGE_KEYS)) {
          batch1.update(pubRef, { ...updateData, updatedAt: now });
        } else {
          if (existingPubPageMap.has(page.id)) await deleteDoc(pubRef);
          batch1.set(pubRef, { ...sanitized, ownerUid: user.uid, createdAt: now, updatedAt: now });
        }
      }
    }
    await batch1.commit();

    // Batch 2: Services, Packages, Testimonials & Media (missing items)
    const batch2 = writeBatch(db);
    const [
      existingDraftServices,
      existingDraftPackages,
      existingDraftTestimonials,
      existingFolders,
      existingMedia,
    ] = await Promise.all([
      getDocs(collection(db, 'draft_services')),
      getDocs(collection(db, 'draft_packages')),
      getDocs(collection(db, 'draft_testimonials')),
      getDocs(collection(db, 'media_folders')),
      getDocs(collection(db, 'media_items')),
    ]);

    const existingSrvMap = new Map(existingDraftServices.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const existingPkgMap = new Map(existingDraftPackages.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const existingTestMap = new Map(existingDraftTestimonials.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const existingFolderIds = new Set(existingFolders.docs.map((d) => d.id));
    const existingMediaIds = new Set(existingMedia.docs.map((d) => d.id));

    const [existingPubSrvMap, existingPubPkgMap, existingPubTestMap] = alsoPublish
      ? await Promise.all([
          getDocs(collection(db, 'published_services')).then((s) => new Map(s.docs.map((d) => [d.id, d.data() as Record<string, unknown>]))),
          getDocs(collection(db, 'published_packages')).then((s) => new Map(s.docs.map((d) => [d.id, d.data() as Record<string, unknown>]))),
          getDocs(collection(db, 'published_testimonials')).then((s) => new Map(s.docs.map((d) => [d.id, d.data() as Record<string, unknown>]))),
        ])
      : [new Map<string, Record<string, unknown>>(), new Map<string, Record<string, unknown>>(), new Map<string, Record<string, unknown>>()];

    for (const srv of DEFAULT_SERVICES) {
      const data = sanitizeServicePayload(srv);
      const ref = doc(db, 'draft_services', srv.id);
      if (canSafelyUpdate(existingSrvMap.get(srv.id), ALLOWED_SERVICE_KEYS)) {
        batch2.update(ref, { ...data, updatedAt: now });
      } else {
        if (existingSrvMap.has(srv.id)) await deleteDoc(ref);
        batch2.set(ref, { id: srv.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
      if (alsoPublish) {
        const pubSrvRef = doc(db, 'published_services', srv.id);
        if (canSafelyUpdate(existingPubSrvMap.get(srv.id), ALLOWED_SERVICE_KEYS)) {
          batch2.update(pubSrvRef, { ...data, updatedAt: now });
        } else {
          if (existingPubSrvMap.has(srv.id)) await deleteDoc(pubSrvRef);
          batch2.set(pubSrvRef, { id: srv.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
        }
      }
    }

    for (const pkg of DEFAULT_PACKAGES) {
      const data = sanitizePackagePayload(pkg);
      const ref = doc(db, 'draft_packages', pkg.id);
      if (canSafelyUpdate(existingPkgMap.get(pkg.id), ALLOWED_PACKAGE_KEYS)) {
        batch2.update(ref, { ...data, updatedAt: now });
      } else {
        if (existingPkgMap.has(pkg.id)) await deleteDoc(ref);
        batch2.set(ref, { id: pkg.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
      if (alsoPublish) {
        const pubPkgRef = doc(db, 'published_packages', pkg.id);
        if (canSafelyUpdate(existingPubPkgMap.get(pkg.id), ALLOWED_PACKAGE_KEYS)) {
          batch2.update(pubPkgRef, { ...data, updatedAt: now });
        } else {
          if (existingPubPkgMap.has(pkg.id)) await deleteDoc(pubPkgRef);
          batch2.set(pubPkgRef, { id: pkg.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
        }
      }
    }

    for (const t of DEFAULT_TESTIMONIALS) {
      const data = sanitizeTestimonialPayload(t);
      const ref = doc(db, 'draft_testimonials', t.id);
      if (canSafelyUpdate(existingTestMap.get(t.id), ALLOWED_TESTIMONIAL_KEYS)) {
        batch2.update(ref, { ...data, updatedAt: now });
      } else {
        if (existingTestMap.has(t.id)) await deleteDoc(ref);
        batch2.set(ref, { id: t.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
      if (alsoPublish) {
        const pubTestRef = doc(db, 'published_testimonials', t.id);
        if (canSafelyUpdate(existingPubTestMap.get(t.id), ALLOWED_TESTIMONIAL_KEYS)) {
          batch2.update(pubTestRef, { ...data, updatedAt: now });
        } else {
          if (existingPubTestMap.has(t.id)) await deleteDoc(pubTestRef);
          batch2.set(pubTestRef, { id: t.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
        }
      }
    }

    for (const folder of DEFAULT_MEDIA_FOLDERS) {
      if (!existingFolderIds.has(folder.id)) {
        batch2.set(doc(db, 'media_folders', folder.id), {
          ...stripUndefined(folder),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const item of DEFAULT_MEDIA_ITEMS) {
      if (!existingMediaIds.has(item.id)) {
        batch2.set(doc(db, 'media_items', item.id), {
          ...stripUndefined(item),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await batch2.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'apply_brand_template');
  }
}

export async function bootstrapDraftAndPublishedIfEmpty(user: User): Promise<void> {
  const draftConfigRef = doc(db, 'draft_portfolio', 'main');
  const pubConfigRef = doc(db, 'published_portfolio', 'main');

  const [
    draftCfgSnap,
    pubCfgSnap,
    draftPagesSnap,
    draftSrvSnap,
    draftPkgSnap,
    draftTestSnap,
    foldersSnap,
    mediaSnap,
    pubPagesSnap,
    pubSrvSnap,
    pubPkgSnap,
    pubTestSnap,
  ] = await Promise.all([
    getDoc(draftConfigRef).catch((err) => handleFirestoreError(err, OperationType.GET, 'draft_portfolio/main')),
    getDoc(pubConfigRef).catch((err) => handleFirestoreError(err, OperationType.GET, 'published_portfolio/main')),
    getDocs(collection(db, 'draft_pages')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'draft_pages')),
    getDocs(collection(db, 'draft_services')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'draft_services')),
    getDocs(collection(db, 'draft_packages')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'draft_packages')),
    getDocs(collection(db, 'draft_testimonials')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'draft_testimonials')),
    getDocs(collection(db, 'media_folders')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'media_folders')),
    getDocs(collection(db, 'media_items')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'media_items')),
    getDocs(collection(db, 'published_pages')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'published_pages')),
    getDocs(collection(db, 'published_services')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'published_services')),
    getDocs(collection(db, 'published_packages')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'published_packages')),
    getDocs(collection(db, 'published_testimonials')).catch((err) => handleFirestoreError(err, OperationType.LIST, 'published_testimonials')),
  ]);

  const now = serverTimestamp();
  const existingDraftCfg = draftCfgSnap.exists() ? (draftCfgSnap.data() as PortfolioConfig) : null;
  const existingPubCfg = pubCfgSnap.exists() ? (pubCfgSnap.data() as PortfolioConfig) : null;

  if (existingDraftCfg && existingDraftCfg.studioName === 'PORTFOLIO STUDIO PRO' && !existingDraftCfg.hasUnpublishedChanges) {
    await applyBrandTemplateToDraft(user, true);
    return;
  }

  let firstStepError: Error | null = null;
  const recordStepError = (err: unknown, op: OperationType, path: string) => {
    try {
      handleFirestoreError(err, op, path);
    } catch (wrapped) {
      if (!firstStepError && wrapped instanceof Error) {
        firstStepError = wrapped;
      }
    }
  };

  // 1. Ensure draft & published config documents exist (migrating from published -> draft if needed)
  const defaultCleanCfg = sanitizeConfigPayload({
    ...DEFAULT_PORTFOLIO_CONFIG,
    hasUnpublishedChanges: false,
  });

  if (!draftCfgSnap.exists()) {
    try {
      const draftSourceCfg = existingPubCfg
        ? sanitizeConfigPayload({ ...existingPubCfg, hasUnpublishedChanges: false })
        : defaultCleanCfg;
      await setDoc(draftConfigRef, { ...draftSourceCfg, ownerUid: user.uid, createdAt: now, updatedAt: now });
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'draft_portfolio/main');
    }
  }

  if (!pubCfgSnap.exists()) {
    try {
      const pubSourceCfg = existingDraftCfg
        ? sanitizeConfigPayload({ ...existingDraftCfg, hasUnpublishedChanges: false })
        : defaultCleanCfg;
      await setDoc(pubConfigRef, { ...pubSourceCfg, ownerUid: user.uid, createdAt: now, updatedAt: now });
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'published_portfolio/main');
    }
  }

  const draftPagesList = draftPagesSnap.docs.map((d) => d.data() as PortfolioPage);
  const pubPagesList = pubPagesSnap.docs.map((d) => d.data() as PortfolioPage);
  const draftSrvList = draftSrvSnap.docs.map((d) => d.data() as ServiceItem);
  const pubSrvList = pubSrvSnap.docs.map((d) => d.data() as ServiceItem);
  const draftPkgList = draftPkgSnap.docs.map((d) => d.data() as PackageItem);
  const pubPkgList = pubPkgSnap.docs.map((d) => d.data() as PackageItem);
  const draftTestList = draftTestSnap.docs.map((d) => d.data() as TestimonialItem);
  const pubTestList = pubTestSnap.docs.map((d) => d.data() as TestimonialItem);

  // 2. Seed any empty draft collection independently (preferring live published data first!)
  if (draftPagesSnap.empty) {
    try {
      const sourcePages = pubPagesList.length > 0 ? pubPagesList : DEFAULT_PAGES;
      const batch = writeBatch(db);
      for (const page of sourcePages) {
        batch.set(doc(db, 'draft_pages', page.id), {
          ...sanitizePagePayload(page),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'draft_pages');
    }
  }

  if (draftSrvSnap.empty) {
    try {
      const sourceSrvs = pubSrvList.length > 0 ? pubSrvList : DEFAULT_SERVICES;
      const batch = writeBatch(db);
      for (const srv of sourceSrvs) {
        batch.set(doc(db, 'draft_services', srv.id), {
          id: srv.id,
          ...sanitizeServicePayload(srv),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'draft_services');
    }
  }

  if (draftPkgSnap.empty) {
    try {
      const sourcePkgs = pubPkgList.length > 0 ? pubPkgList : DEFAULT_PACKAGES;
      const batch = writeBatch(db);
      for (const pkg of sourcePkgs) {
        batch.set(doc(db, 'draft_packages', pkg.id), {
          id: pkg.id,
          ...sanitizePackagePayload(pkg),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'draft_packages');
    }
  }

  if (draftTestSnap.empty) {
    try {
      const sourceTests = pubTestList.length > 0 ? pubTestList : DEFAULT_TESTIMONIALS;
      const batch = writeBatch(db);
      for (const t of sourceTests) {
        batch.set(doc(db, 'draft_testimonials', t.id), {
          id: t.id,
          ...sanitizeTestimonialPayload(t),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'draft_testimonials');
    }
  }

  if (foldersSnap.empty) {
    try {
      const batch = writeBatch(db);
      for (const folder of DEFAULT_MEDIA_FOLDERS) {
        batch.set(doc(db, 'media_folders', folder.id), {
          ...stripUndefined(folder),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'media_folders');
    }
  }

  if (mediaSnap.empty) {
    try {
      const batch = writeBatch(db);
      for (const item of DEFAULT_MEDIA_ITEMS) {
        batch.set(doc(db, 'media_items', item.id), {
          ...stripUndefined(item),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'media_items');
    }
  }

  // 3. Seed any empty published collection independently
  if (pubPagesSnap.empty) {
    try {
      const sourcePages = draftPagesList.length > 0 ? draftPagesList : DEFAULT_PAGES;
      const batch = writeBatch(db);
      for (const page of sourcePages) {
        batch.set(doc(db, 'published_pages', page.id), {
          ...sanitizePagePayload(page),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'published_pages');
    }
  }

  if (pubSrvSnap.empty) {
    try {
      const sourceSrvs = draftSrvList.length > 0 ? draftSrvList : DEFAULT_SERVICES;
      const batch = writeBatch(db);
      for (const srv of sourceSrvs) {
        batch.set(doc(db, 'published_services', srv.id), {
          id: srv.id,
          ...sanitizeServicePayload(srv),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'published_services');
    }
  }

  if (pubPkgSnap.empty) {
    try {
      const sourcePkgs = draftPkgList.length > 0 ? draftPkgList : DEFAULT_PACKAGES;
      const batch = writeBatch(db);
      for (const pkg of sourcePkgs) {
        batch.set(doc(db, 'published_packages', pkg.id), {
          id: pkg.id,
          ...sanitizePackagePayload(pkg),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'published_packages');
    }
  }

  if (pubTestSnap.empty) {
    try {
      const sourceTests = draftTestList.length > 0 ? draftTestList : DEFAULT_TESTIMONIALS;
      const batch = writeBatch(db);
      for (const t of sourceTests) {
        batch.set(doc(db, 'published_testimonials', t.id), {
          id: t.id,
          ...sanitizeTestimonialPayload(t),
          ownerUid: user.uid,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      recordStepError(err, OperationType.CREATE, 'published_testimonials');
    }
  }

  if (firstStepError) {
    throw firstStepError;
  }
}

export async function saveDraftConfig(config: PortfolioConfig, user: User): Promise<void> {
  const ref = doc(db, 'draft_portfolio', 'main');
  try {
    const snap = await getDoc(ref);
    const payload = sanitizeConfigPayload({ ...config, hasUnpublishedChanges: true });
    if (snap.exists() && canSafelyUpdate(snap.data() as Record<string, unknown>, ALLOWED_CONFIG_KEYS)) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      if (snap.exists()) await deleteDoc(ref);
      await setDoc(ref, {
        ...payload,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'draft_portfolio/main');
  }
}

export async function saveDraftPage(page: PortfolioPage, user: User): Promise<void> {
  const ref = doc(db, 'draft_pages', page.id);
  try {
    const snap = await getDoc(ref);
    const payload = sanitizePagePayload(page);
    if (snap.exists() && canSafelyUpdate(snap.data() as Record<string, unknown>, ALLOWED_PAGE_KEYS)) {
      const { id: _ignoreId, ...updateFields } = payload;
      await updateDoc(ref, {
        ...updateFields,
        updatedAt: serverTimestamp(),
      });
    } else {
      if (snap.exists()) await deleteDoc(ref);
      await setDoc(ref, {
        ...payload,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `draft_pages/${page.id}`);
  }
}

export async function deleteDraftPage(
  pageId: string,
  options?: { alsoDeletePublished?: boolean }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'draft_pages', pageId));
    if (options?.alsoDeletePublished) {
      try {
        await deleteDoc(doc(db, 'published_pages', pageId));
      } catch {
        // Ignore if page was never published
      }
    }
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `draft_pages/${pageId}`);
  }
}

export async function reorderDraftPages(pages: PortfolioPage[]): Promise<void> {
  try {
    const existingSnap = await getDocs(collection(db, 'draft_pages'));
    const existingMap = new Map(existingSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const batch = writeBatch(db);
    const now = serverTimestamp();
    const uid = auth.currentUser?.uid;

    for (let idx = 0; idx < pages.length; idx++) {
      const p = pages[idx];
      const ref = doc(db, 'draft_pages', p.id);
      const existingData = existingMap.get(p.id);
      if (canSafelyUpdate(existingData, ALLOWED_PAGE_KEYS)) {
        batch.update(ref, {
          order: idx + 1,
          updatedAt: now,
        });
      } else if (uid) {
        if (existingData) await deleteDoc(ref);
        batch.set(ref, {
          ...sanitizePagePayload({ ...p, order: idx + 1 }),
          ownerUid: uid,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    await batch.commit();
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'draft_pages/reorder');
  }
}

export async function saveDraftService(service: ServiceItem, user: User): Promise<void> {
  const ref = doc(db, 'draft_services', service.id);
  try {
    const snap = await getDoc(ref);
    const payload = sanitizeServicePayload(service);
    if (snap.exists() && canSafelyUpdate(snap.data() as Record<string, unknown>, ALLOWED_SERVICE_KEYS)) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      if (snap.exists()) await deleteDoc(ref);
      await setDoc(ref, {
        id: service.id,
        ...payload,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `draft_services/${service.id}`);
  }
}

export async function deleteDraftService(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'draft_services', id));
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `draft_services/${id}`);
  }
}

export async function saveDraftPackage(pkg: PackageItem, user: User): Promise<void> {
  const ref = doc(db, 'draft_packages', pkg.id);
  try {
    const snap = await getDoc(ref);
    const payload = sanitizePackagePayload(pkg);
    if (snap.exists() && canSafelyUpdate(snap.data() as Record<string, unknown>, ALLOWED_PACKAGE_KEYS)) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      if (snap.exists()) await deleteDoc(ref);
      await setDoc(ref, {
        id: pkg.id,
        ...payload,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `draft_packages/${pkg.id}`);
  }
}

export async function deleteDraftPackage(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'draft_packages', id));
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `draft_packages/${id}`);
  }
}

export async function saveDraftTestimonial(item: TestimonialItem, user: User): Promise<void> {
  const ref = doc(db, 'draft_testimonials', item.id);
  try {
    const snap = await getDoc(ref);
    const payload = sanitizeTestimonialPayload(item);
    if (snap.exists() && canSafelyUpdate(snap.data() as Record<string, unknown>, ALLOWED_TESTIMONIAL_KEYS)) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      if (snap.exists()) await deleteDoc(ref);
      await setDoc(ref, {
        id: item.id,
        ...payload,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `draft_testimonials/${item.id}`);
  }
}

export async function deleteDraftTestimonial(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'draft_testimonials', id));
    await markUnpublishedChanges();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `draft_testimonials/${id}`);
  }
}

async function markUnpublishedChanges(): Promise<void> {
  const ref = doc(db, 'draft_portfolio', 'main');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        hasUnpublishedChanges: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-blocking flag update
  }
}

export async function publishDraftToLive(
  bundle: PortfolioBundle,
  user: User,
  versionLabel: string,
  notes = ''
): Promise<string> {
  const versionId = `ver_${Date.now()}`;
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    // Sync pages: delete published pages not in draft, upsert all draft pages
    const existingPubPages = await getDocs(collection(db, 'published_pages'));
    const existingPubPageMap = new Map(existingPubPages.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const draftPageIds = new Set(bundle.pages.map((p) => p.id));
    existingPubPages.docs.forEach((d) => {
      if (!draftPageIds.has(d.id)) {
        batch.delete(d.ref);
      }
    });

    for (const p of bundle.pages) {
      const pubRef = doc(db, 'published_pages', p.id);
      const existingData = existingPubPageMap.get(p.id);
      const sanitized = sanitizePagePayload(p);
      if (canSafelyUpdate(existingData, ALLOWED_PAGE_KEYS)) {
        const { id: _id, ...updateData } = sanitized;
        batch.update(pubRef, { ...updateData, updatedAt: now });
      } else {
        if (existingData) await deleteDoc(pubRef);
        batch.set(pubRef, { ...sanitized, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
    }

    // Sync services
    const existingPubServices = await getDocs(collection(db, 'published_services'));
    const existingPubSrvMap = new Map(existingPubServices.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const draftSrvIds = new Set(bundle.services.map((s) => s.id));
    existingPubServices.docs.forEach((d) => {
      if (!draftSrvIds.has(d.id)) batch.delete(d.ref);
    });
    for (const s of bundle.services) {
      const ref = doc(db, 'published_services', s.id);
      const existingData = existingPubSrvMap.get(s.id);
      const data = sanitizeServicePayload(s);
      if (canSafelyUpdate(existingData, ALLOWED_SERVICE_KEYS)) {
        batch.update(ref, { ...data, updatedAt: now });
      } else {
        if (existingData) await deleteDoc(ref);
        batch.set(ref, { id: s.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
    }

    // Sync packages
    const existingPubPackages = await getDocs(collection(db, 'published_packages'));
    const existingPubPkgMap = new Map(existingPubPackages.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const draftPkgIds = new Set(bundle.packages.map((p) => p.id));
    existingPubPackages.docs.forEach((d) => {
      if (!draftPkgIds.has(d.id)) batch.delete(d.ref);
    });
    for (const p of bundle.packages) {
      const ref = doc(db, 'published_packages', p.id);
      const existingData = existingPubPkgMap.get(p.id);
      const data = sanitizePackagePayload(p);
      if (canSafelyUpdate(existingData, ALLOWED_PACKAGE_KEYS)) {
        batch.update(ref, { ...data, updatedAt: now });
      } else {
        if (existingData) await deleteDoc(ref);
        batch.set(ref, { id: p.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
    }

    // Sync testimonials
    const existingPubTest = await getDocs(collection(db, 'published_testimonials'));
    const existingPubTestMap = new Map(existingPubTest.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const draftTestIds = new Set(bundle.testimonials.map((t) => t.id));
    existingPubTest.docs.forEach((d) => {
      if (!draftTestIds.has(d.id)) batch.delete(d.ref);
    });
    for (const t of bundle.testimonials) {
      const ref = doc(db, 'published_testimonials', t.id);
      const existingData = existingPubTestMap.get(t.id);
      const data = sanitizeTestimonialPayload(t);
      if (canSafelyUpdate(existingData, ALLOWED_TESTIMONIAL_KEYS)) {
        batch.update(ref, { ...data, updatedAt: now });
      } else {
        if (existingData) await deleteDoc(ref);
        batch.set(ref, { id: t.id, ...data, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
    }

    // Update config on both published & draft
    const cleanConfig = sanitizeConfigPayload({
      ...bundle.config,
      hasUnpublishedChanges: false,
      lastPublishedVersionId: versionId,
    });
    const pubConfigRef = doc(db, 'published_portfolio', 'main');
    const pubConfigSnap = await getDoc(pubConfigRef);
    if (pubConfigSnap.exists() && canSafelyUpdate(pubConfigSnap.data() as Record<string, unknown>, ALLOWED_CONFIG_KEYS)) {
      batch.update(pubConfigRef, { ...cleanConfig, updatedAt: now });
    } else {
      if (pubConfigSnap.exists()) await deleteDoc(pubConfigRef);
      batch.set(pubConfigRef, {
        ...cleanConfig,
        ownerUid: user.uid,
        createdAt: now,
        updatedAt: now,
      });
    }
    const draftConfigRef = doc(db, 'draft_portfolio', 'main');
    const draftConfigSnap = await getDoc(draftConfigRef);
    if (draftConfigSnap.exists() && canSafelyUpdate(draftConfigSnap.data() as Record<string, unknown>, ALLOWED_CONFIG_KEYS)) {
      batch.update(draftConfigRef, {
        hasUnpublishedChanges: false,
        lastPublishedVersionId: versionId,
        updatedAt: now,
      });
    } else {
      if (draftConfigSnap.exists()) await deleteDoc(draftConfigRef);
      batch.set(draftConfigRef, {
        ...cleanConfig,
        ownerUid: user.uid,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Save snapshot version
    const snapshot: PortfolioSnapshot = {
      config: cleanConfig,
      pages: bundle.pages.map((p) => sanitizePagePayload(p)),
      services: bundle.services.map(({ createdAt: _c, updatedAt: _u, ownerUid: _o, ...rest }) => stripUndefined(rest)),
      packages: bundle.packages.map(({ createdAt: _c, updatedAt: _u, ownerUid: _o, ...rest }) => stripUndefined(rest)),
      testimonials: bundle.testimonials.map(({ createdAt: _c, updatedAt: _u, ownerUid: _o, ...rest }) => stripUndefined(rest)),
    };

    batch.set(doc(db, 'portfolio_versions', versionId), {
      id: versionId,
      label: versionLabel.slice(0, 140),
      notes: notes.slice(0, 400),
      snapshot,
      ownerUid: user.uid,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();
    return versionId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'publish_portfolio');
  }
}

export function subscribeVersions(
  onData: (versions: PortfolioVersion[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'portfolio_versions'), orderBy('createdAt', 'desc')),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as PortfolioVersion));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'portfolio_versions');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export async function restoreVersionToDraft(version: PortfolioVersion, user: User): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();
    const snap = version.snapshot;

    const existingDraftPages = await getDocs(collection(db, 'draft_pages'));
    const existingDraftPageMap = new Map(existingDraftPages.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
    const nextIds = new Set(snap.pages.map((p) => p.id));
    existingDraftPages.docs.forEach((d) => {
      if (!nextIds.has(d.id)) batch.delete(d.ref);
    });

    for (const p of snap.pages) {
      const ref = doc(db, 'draft_pages', p.id);
      const existingData = existingDraftPageMap.get(p.id);
      const payload = sanitizePagePayload(p);
      if (canSafelyUpdate(existingData, ALLOWED_PAGE_KEYS)) {
        const { id: _id, ...updateData } = payload;
        batch.update(ref, { ...updateData, updatedAt: now });
      } else {
        if (existingData) await deleteDoc(ref);
        batch.set(ref, { ...payload, ownerUid: user.uid, createdAt: now, updatedAt: now });
      }
    }

    const draftCfgRef = doc(db, 'draft_portfolio', 'main');
    const draftCfgSnap = await getDoc(draftCfgRef);
    const cleanRestoredCfg = sanitizeConfigPayload({ ...snap.config, hasUnpublishedChanges: true });
    if (draftCfgSnap.exists() && canSafelyUpdate(draftCfgSnap.data() as Record<string, unknown>, ALLOWED_CONFIG_KEYS)) {
      batch.update(draftCfgRef, {
        ...cleanRestoredCfg,
        updatedAt: now,
      });
    } else {
      if (draftCfgSnap.exists()) await deleteDoc(draftCfgRef);
      batch.set(draftCfgRef, {
        ...cleanRestoredCfg,
        ownerUid: user.uid,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'restore_version');
  }
}
