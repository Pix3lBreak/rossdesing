import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const CLOUD_MEDIA_PREFIX = 'cloud-media://';

const mediaAssetCache = new Map<string, string>();
const pendingMediaFetches = new Set<string>();
const mediaListeners = new Set<() => void>();

function notifyMediaListeners() {
  mediaListeners.forEach((listener) => listener());
}

export function primeCloudMediaCache(assetId: string, dataUrl: string): void {
  if (!assetId || !dataUrl) return;
  mediaAssetCache.set(assetId, dataUrl);
  notifyMediaListeners();
}

export function useCloudMediaSync(): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const listener = () => setRevision((r) => r + 1);
    mediaListeners.add(listener);
    return () => {
      mediaListeners.delete(listener);
    };
  }, []);

  return revision;
}

/**
 * Normalizes asset URLs so `cloud-media://<id>` Firestore assets, legacy `/src/assets/images/*`
 * paths, and public `/assets/*` or HTTPS URLs always resolve cleanly.
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith(CLOUD_MEDIA_PREFIX)) {
    const assetId = trimmed.slice(CLOUD_MEDIA_PREFIX.length).trim();
    if (!assetId) return '';

    const cached = mediaAssetCache.get(assetId);
    if (cached !== undefined) {
      return cached;
    }

    if (!pendingMediaFetches.has(assetId)) {
      pendingMediaFetches.add(assetId);
      void getDoc(doc(db, 'media_assets', assetId))
        .then((snap) => {
          const dataUrl = snap.exists() ? String((snap.data() as { dataUrl?: string }).dataUrl || '') : '';
          mediaAssetCache.set(assetId, dataUrl);
          notifyMediaListeners();
        })
        .catch(() => {
          // Leave uncached so subsequent retry is possible if offline briefly
        })
        .finally(() => {
          pendingMediaFetches.delete(assetId);
        });
    }
    return '';
  }

  if (trimmed.startsWith('/src/assets/images/')) {
    return trimmed.replace('/src/assets/images/', '/assets/images/');
  }
  return trimmed;
}
