import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, storage } from '../config/firebase';
import type { MediaFolder, MediaItem } from '../types/portfolio';
import { CLOUD_MEDIA_PREFIX, primeCloudMediaCache } from '../utils/assetUrl';
import { normalizeSafeUrl } from '../utils/videoEmbed';

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/avif',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FIRESTORE_DATA_URL_CHARS = 780_000;
const STORAGE_STALL_TIMEOUT_MS = 3500;

export function validateMediaFile(file: File): { valid: boolean; mediaType: 'image' | 'logo' | 'video'; error?: string } {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, mediaType: 'image', error: 'La imagen excede el límite de 25 MB.' };
    }
    const isLogo = file.type === 'image/svg+xml' || file.name.toLowerCase().includes('logo');
    return { valid: true, mediaType: isLogo ? 'logo' : 'image' };
  }
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_SIZE) {
      return { valid: false, mediaType: 'video', error: 'El video excede el límite de 100 MB.' };
    }
    return { valid: true, mediaType: 'video' };
  }
  return {
    valid: false,
    mediaType: 'image',
    error: 'Formato no soportado. Usa PNG, JPG, GIF, WEBP, SVG, AVIF o MP4/WebM.',
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(objectUrl) });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo procesar la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
}

async function compressImageForFirestore(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  if (file.type === 'image/svg+xml') {
    const rawSvg = await readFileAsDataUrl(file);
    if (rawSvg.length <= MAX_FIRESTORE_DATA_URL_CHARS) {
      return { dataUrl: rawSvg, mimeType: 'image/svg+xml' };
    }
    throw new Error('El archivo SVG supera el límite máximo permitido (750 KB).');
  }

  if (file.type === 'image/gif') {
    const rawGif = await readFileAsDataUrl(file);
    if (rawGif.length <= MAX_FIRESTORE_DATA_URL_CHARS) {
      return { dataUrl: rawGif, mimeType: 'image/gif' };
    }
    // If GIF is larger than 580 KB, fall through to static compressed frame
  }

  const { img, revoke } = await loadImageElement(file);
  try {
    const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const passes = [
      { maxDim: 1440, quality: 0.85 },
      { maxDim: 1120, quality: 0.78 },
      { maxDim: 860, quality: 0.7 },
      { maxDim: 640, quality: 0.6 },
    ];

    for (const pass of passes) {
      const scale = Math.min(1, pass.maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo inicializar el procesador gráfico del navegador.');
      }
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP (compact & supports transparency), then PNG/JPEG fallback
      const webpCandidate = canvas.toDataURL('image/webp', pass.quality);
      if (webpCandidate.startsWith('data:image/webp') && webpCandidate.length <= MAX_FIRESTORE_DATA_URL_CHARS) {
        return { dataUrl: webpCandidate, mimeType: 'image/webp' };
      }

      const fallbackMime = preserveAlpha ? 'image/png' : 'image/jpeg';
      const fallbackCandidate = canvas.toDataURL(fallbackMime, pass.quality);
      if (fallbackCandidate.length <= MAX_FIRESTORE_DATA_URL_CHARS) {
        return { dataUrl: fallbackCandidate, mimeType: fallbackMime };
      }
    }

    throw new Error('La imagen es demasiado pesada incluso tras optimizarla. Prueba con una versión más ligera.');
  } finally {
    revoke();
  }
}

async function tryFirebaseStorageUpload(
  file: File,
  storagePath: string,
  onProgress?: (pct: number) => void
): Promise<string | null> {
  const storageRef = ref(storage, storagePath);
  return new Promise((resolve) => {
    let settled = false;
    let sawBytes = false;
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(stallTimer);
      resolve(url);
    };

    const stallTimer = setTimeout(() => {
      if (!sawBytes && !settled) {
        try {
          task.cancel();
        } catch {
          // Ignore cancel error
        }
        finish(null);
      }
    }, STORAGE_STALL_TIMEOUT_MS);

    task.on(
      'state_changed',
      (snap) => {
        if (snap.bytesTransferred > 0) {
          sawBytes = true;
          clearTimeout(stallTimer);
          if (onProgress && snap.totalBytes > 0) {
            onProgress(Math.max(10, Math.min(95, Math.round((snap.bytesTransferred / snap.totalBytes) * 100))));
          }
        }
      },
      () => {
        finish(null);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          finish(downloadUrl);
        } catch {
          finish(null);
        }
      }
    );
  });
}

export function subscribeMediaLibrary(
  onFolders: (folders: MediaFolder[]) => void,
  onItems: (items: MediaItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const unsubFolders = onSnapshot(
    query(collection(db, 'media_folders'), orderBy('name', 'asc')),
    (snap) => {
      onFolders(snap.docs.map((d) => d.data() as MediaFolder));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'media_folders');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );

  const unsubItems = onSnapshot(
    query(collection(db, 'media_items'), orderBy('createdAt', 'desc')),
    (snap) => {
      onItems(snap.docs.map((d) => d.data() as MediaItem));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'media_items');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );

  return () => {
    unsubFolders();
    unsubItems();
  };
}

export async function createMediaFolder(name: string, user: User): Promise<string> {
  const id = `folder_${Date.now()}`;
  try {
    await setDoc(doc(db, 'media_folders', id), {
      id,
      name: name.trim().slice(0, 100),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `media_folders/${id}`);
  }
}

export async function deleteMediaFolder(folderId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'media_folders', folderId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `media_folders/${folderId}`);
  }
}

export async function uploadMediaFile(
  file: File,
  user: User,
  options: {
    folderId?: string;
    category?: string;
    mediaTypeOverride?: 'image' | 'logo' | 'video';
    onProgress?: (pct: number) => void;
  } = {}
): Promise<MediaItem> {
  const check = validateMediaFile(file);
  if (!check.valid) {
    throw new Error(check.error || 'Archivo inválido.');
  }

  const mediaType = options.mediaTypeOverride || check.mediaType;
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const id = `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const storagePath = `portfolios/${user.uid}/${id}_${cleanFileName}`;

  options.onProgress?.(10);

  let finalUrl = await tryFirebaseStorageUpload(file, storagePath, options.onProgress);
  let finalStoragePath = finalUrl ? storagePath : '';
  let finalMimeType = file.type.slice(0, 100);
  let finalSizeBytes = Math.round(file.size);

  if (!finalUrl) {
    if (mediaType === 'video') {
      if (file.size <= 585_000) {
        options.onProgress?.(45);
        const videoDataUrl = await readFileAsDataUrl(file);
        if (videoDataUrl.length <= MAX_FIRESTORE_DATA_URL_CHARS) {
          options.onProgress?.(75);
          try {
            await setDoc(doc(db, 'media_assets', id), {
              id,
              dataUrl: videoDataUrl,
              mimeType: finalMimeType,
              sizeBytes: Math.round(videoDataUrl.length),
              ownerUid: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `media_assets/${id}`);
          }
          primeCloudMediaCache(id, videoDataUrl);
          finalUrl = `${CLOUD_MEDIA_PREFIX}${id}`;
          finalSizeBytes = Math.round(videoDataUrl.length);
        }
      }
      if (!finalUrl) {
        throw new Error(
          'Este video MP4 pesa más de 580 KB y Firebase Storage no está activado en la consola. Usa el botón "+ Agregar enlace" para insertar videos de YouTube, Vimeo, Google Drive, TikTok o URL MP4 directa (sin límite de peso).'
        );
      }
    } else {
      options.onProgress?.(30);
      const optimized = await compressImageForFirestore(file);
      options.onProgress?.(65);
      finalMimeType = optimized.mimeType.slice(0, 100);
      finalSizeBytes = Math.round(optimized.dataUrl.length);

      try {
        await setDoc(doc(db, 'media_assets', id), {
          id,
          dataUrl: optimized.dataUrl,
          mimeType: finalMimeType,
          sizeBytes: finalSizeBytes,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `media_assets/${id}`);
      }

      primeCloudMediaCache(id, optimized.dataUrl);
      finalUrl = `${CLOUD_MEDIA_PREFIX}${id}`;
      options.onProgress?.(88);
    }
  }

  const item: MediaItem = {
    id,
    name: file.name.slice(0, 200),
    url: finalUrl,
    ...(finalStoragePath ? { storagePath: finalStoragePath } : {}),
    mediaType,
    mimeType: finalMimeType,
    sizeBytes: finalSizeBytes,
    folderId: (options.folderId || '').slice(0, 128),
    category: (options.category || '').slice(0, 80),
    ownerUid: user.uid,
  };

  try {
    await setDoc(doc(db, 'media_items', id), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `media_items/${id}`);
  }

  options.onProgress?.(100);
  return item;
}

export async function createMediaLinkItem(
  input: {
    name: string;
    url: string;
    mediaType: 'image' | 'logo' | 'video';
    folderId?: string;
    category?: string;
  },
  user: User
): Promise<MediaItem> {
  const safeUrl = normalizeSafeUrl(input.url);
  if (!safeUrl || (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://'))) {
    throw new Error('Ingresa un enlace válido que comience con https:// o http://.');
  }
  if (safeUrl.length > 2000) {
    throw new Error('El enlace supera la longitud máxima permitida (2000 caracteres).');
  }

  const id = `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: MediaItem = {
    id,
    name: (input.name.trim() || safeUrl).slice(0, 200),
    url: safeUrl,
    mediaType: input.mediaType,
    mimeType: input.mediaType === 'video' ? 'video/external-link' : 'image/external-link',
    folderId: (input.folderId || '').slice(0, 128),
    category: (input.category || '').slice(0, 80),
    ownerUid: user.uid,
  };

  try {
    await setDoc(doc(db, 'media_items', id), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `media_items/${id}`);
  }

  return item;
}

export async function updateMediaItemMetadata(
  itemId: string,
  updates: Partial<Pick<MediaItem, 'name' | 'folderId' | 'category' | 'mediaType'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'media_items', itemId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `media_items/${itemId}`);
  }
}

export async function deleteMediaItem(item: MediaItem): Promise<void> {
  if (item.storagePath) {
    try {
      await deleteObject(ref(storage, item.storagePath));
    } catch {
      // Ignore if file already missing in Storage
    }
  }
  if (item.url.startsWith(CLOUD_MEDIA_PREFIX)) {
    const assetId = item.url.slice(CLOUD_MEDIA_PREFIX.length).trim();
    if (assetId) {
      try {
        await deleteDoc(doc(db, 'media_assets', assetId));
      } catch {
        // Ignore if asset doc already deleted
      }
    }
  }
  try {
    await deleteDoc(doc(db, 'media_items', item.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `media_items/${item.id}`);
  }
}
