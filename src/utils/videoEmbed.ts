import { resolveAssetUrl } from './assetUrl';

export type VideoClickMode = 'online' | 'download' | 'external';

export type ParsedVideoSource =
  | { kind: 'empty' }
  | { kind: 'iframe'; embedUrl: string; provider: string; thumbnailUrl?: string; originalUrl: string }
  | { kind: 'video'; src: string; provider: string; originalUrl: string }
  | { kind: 'external'; href: string; provider: string };

export interface ResolvedVideoTarget {
  href: string;
  viewUrl: string;
  downloadUrl: string;
  embedUrl?: string;
  directVideoSrc?: string;
  isDownload: boolean;
  isDrive: boolean;
  isEmpty: boolean;
  provider: string;
  actionLabel: string;
}

export function normalizeSafeUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('cloud-media://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        return parts[1];
      }
    }
  } catch {
    // Ignore invalid URL
  }
  return null;
}

export function extractGoogleDriveId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'drive.google.com' || host === 'drive.usercontent.google.com' || host === 'docs.google.com') {
      const fileMatch = parsed.pathname.match(/\/(?:file\/)?d\/([^/]+)/);
      const id = fileMatch?.[1] || parsed.searchParams.get('id');
      return id || null;
    }
  } catch {
    // Ignore invalid URL
  }
  return null;
}

export function buildGoogleDriveUrls(fileId: string) {
  const safeId = encodeURIComponent(fileId);
  return {
    viewUrl: `https://drive.google.com/file/d/${safeId}/view`,
    previewUrl: `https://drive.google.com/file/d/${safeId}/preview`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${safeId}`,
  };
}

export function isGoogleDriveDownloadUrl(rawUrl?: string): boolean {
  const normalized = normalizeSafeUrl(rawUrl);
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return (
      (host === 'drive.google.com' || host === 'drive.usercontent.google.com') &&
      (u.searchParams.get('export') === 'download' || u.pathname.includes('/download'))
    );
  } catch {
    return false;
  }
}

export function parseVideoSource(rawUrl?: string): ParsedVideoSource {
  const normalized = normalizeSafeUrl(rawUrl);
  if (!normalized) return { kind: 'empty' };

  const resolved = resolveAssetUrl(normalized);
  if (!resolved) return { kind: 'empty' };

  if (resolved.startsWith('data:video/') || resolved.startsWith('blob:')) {
    return { kind: 'video', src: resolved, provider: 'Video', originalUrl: normalized };
  }

  const ytId = extractYouTubeId(normalized);
  if (ytId) {
    return {
      kind: 'iframe',
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(ytId)}?rel=0`,
      provider: 'YouTube',
      thumbnailUrl: `https://img.youtube.com/vi/${encodeURIComponent(ytId)}/hqdefault.jpg`,
      originalUrl: normalized,
    };
  }

  const driveId = extractGoogleDriveId(normalized);
  if (driveId) {
    const drive = buildGoogleDriveUrls(driveId);
    return {
      kind: 'iframe',
      embedUrl: drive.previewUrl,
      provider: 'Google Drive',
      originalUrl: normalized,
    };
  }

  try {
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    // Vimeo
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const match = u.pathname.match(/\/(?:video\/)?(\d+)/);
      if (match?.[1]) {
        return {
          kind: 'iframe',
          embedUrl: `https://player.vimeo.com/video/${match[1]}`,
          provider: 'Vimeo',
          originalUrl: normalized,
        };
      }
    }

    // Loom
    if (host === 'loom.com') {
      const shareMatch = u.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (shareMatch?.[1]) {
        return {
          kind: 'iframe',
          embedUrl: `https://www.loom.com/embed/${shareMatch[1]}`,
          provider: 'Loom',
          originalUrl: normalized,
        };
      }
    }

    // TikTok
    if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
      const videoMatch = u.pathname.match(/\/video\/(\d+)/);
      if (videoMatch?.[1]) {
        return {
          kind: 'iframe',
          embedUrl: `https://www.tiktok.com/embed/v2/${videoMatch[1]}`,
          provider: 'TikTok',
          originalUrl: normalized,
        };
      }
      return { kind: 'external', href: normalized, provider: 'TikTok' };
    }

    // Direct video file extensions or Firebase Storage download URLs
    const lowerPath = u.pathname.toLowerCase();
    if (
      lowerPath.endsWith('.mp4') ||
      lowerPath.endsWith('.webm') ||
      lowerPath.endsWith('.mov') ||
      lowerPath.endsWith('.m4v') ||
      host.includes('firebasestorage.googleapis.com')
    ) {
      return { kind: 'video', src: resolved, provider: 'MP4', originalUrl: normalized };
    }

    return { kind: 'external', href: normalized, provider: host };
  } catch {
    return { kind: 'video', src: resolved, provider: 'Video', originalUrl: normalized };
  }
}

export function resolveVideoClickTarget(
  rawUrl?: string,
  explicitMode?: VideoClickMode,
  customLabel?: string
): ResolvedVideoTarget {
  const applyCustomLabel = (defaultLabel: string) =>
    customLabel !== undefined ? customLabel.trim() : defaultLabel;

  const normalized = normalizeSafeUrl(rawUrl);
  if (!normalized) {
    return {
      href: '',
      viewUrl: '',
      downloadUrl: '',
      isDownload: false,
      isDrive: false,
      isEmpty: true,
      provider: 'Video',
      actionLabel: applyCustomLabel('Agregar enlace de video'),
    };
  }

  const parsed = parseVideoSource(normalized);
  const driveId = extractGoogleDriveId(normalized);
  const effectiveMode: VideoClickMode =
    explicitMode || (isGoogleDriveDownloadUrl(normalized) ? 'download' : 'online');

  if (driveId) {
    const drive = buildGoogleDriveUrls(driveId);
    if (effectiveMode === 'download') {
      return {
        href: drive.downloadUrl,
        viewUrl: drive.viewUrl,
        downloadUrl: drive.downloadUrl,
        embedUrl: drive.previewUrl,
        isDownload: true,
        isDrive: true,
        isEmpty: false,
        provider: 'Video',
        actionLabel: applyCustomLabel('Descargar video'),
      };
    }
    return {
      href: drive.viewUrl,
      viewUrl: drive.viewUrl,
      downloadUrl: drive.downloadUrl,
      embedUrl: drive.previewUrl,
      isDownload: false,
      isDrive: true,
      isEmpty: false,
      provider: 'Video',
      actionLabel: applyCustomLabel(
        effectiveMode === 'external' ? 'Ver video online' : 'Reproducir video'
      ),
    };
  }

  const provider = parsed.kind === 'empty' ? 'Video' : parsed.provider;
  const isDownload = effectiveMode === 'download';

  if (parsed.kind === 'iframe') {
    return {
      href: normalized,
      viewUrl: normalized,
      downloadUrl: normalized,
      embedUrl: parsed.embedUrl,
      isDownload,
      isDrive: false,
      isEmpty: false,
      provider,
      actionLabel: applyCustomLabel(
        isDownload
          ? 'Descargar video'
          : effectiveMode === 'external'
          ? 'Ver video online'
          : 'Reproducir video'
      ),
    };
  }

  if (parsed.kind === 'video') {
    return {
      href: parsed.src,
      viewUrl: parsed.src,
      downloadUrl: parsed.src,
      directVideoSrc: parsed.src,
      isDownload,
      isDrive: false,
      isEmpty: false,
      provider,
      actionLabel: applyCustomLabel(isDownload ? 'Descargar video' : 'Reproducir video'),
    };
  }

  return {
    href: normalized,
    viewUrl: normalized,
    downloadUrl: normalized,
    isDownload,
    isDrive: false,
    isEmpty: false,
    provider,
    actionLabel: applyCustomLabel(isDownload ? 'Descargar video' : 'Ver video online'),
  };
}

export function isLikelyVideoUrl(rawUrl: string): boolean {
  const parsed = parseVideoSource(rawUrl);
  return parsed.kind === 'iframe' || parsed.kind === 'video' || Boolean(extractGoogleDriveId(rawUrl));
}
