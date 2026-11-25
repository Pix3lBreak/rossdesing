import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { GalleryMediaItem, VisualIdentity } from '../../types/portfolio';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { parseVideoSource, resolveVideoClickTarget } from '../../utils/videoEmbed';

interface MediaLightboxModalProps {
  item: GalleryMediaItem;
  items?: GalleryMediaItem[];
  identity?: VisualIdentity;
  onClose: () => void;
  onSelectItem?: (next: GalleryMediaItem) => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  item,
  items = [],
  identity,
  onClose,
  onSelectItem,
}) => {
  const [imageZoom, setImageZoom] = useState<1 | 1.6 | 2.2>(1);
  const [fullscreenStage, setFullscreenStage] = useState(false);

  const isVideo = item.mediaType === 'video' || Boolean(item.videoUrl);
  const targetVideoUrl = item.videoUrl || item.url;
  const parsedVideo = isVideo ? parseVideoSource(targetVideoUrl) : null;
  const videoTarget = isVideo
    ? resolveVideoClickTarget(targetVideoUrl, item.videoAction)
    : null;

  const currentIdx = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIdx > 0 && Boolean(onSelectItem);
  const hasNext = currentIdx >= 0 && currentIdx < items.length - 1 && Boolean(onSelectItem);

  useEffect(() => {
    setImageZoom(1);
  }, [item.id, item.url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onSelectItem) {
        onSelectItem(items[currentIdx - 1]);
      } else if (e.key === 'ArrowRight' && hasNext && onSelectItem) {
        onSelectItem(items[currentIdx + 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIdx, hasNext, hasPrev, items, onClose, onSelectItem]);

  const accent = identity?.accentColor || '#A855F7';
  const primary = identity?.primaryColor || '#5B21B6';
  const imageSrc = resolveAssetUrl(item.url);

  const cycleZoom = () => {
    setImageZoom((z) => (z === 1 ? 1.6 : z === 1.6 ? 2.2 : 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#07060B]/92 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6 md:p-10 transition-opacity duration-200"
      onClick={onClose}
    >
      {/* Subtle Ambient Brand Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-35"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${accent}44 0%, ${primary}22 36%, transparent 72%)`,
        }}
      />

      {/* Previous / Next Floating Navigation */}
      {hasPrev && onSelectItem && (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onSelectItem(items[currentIdx - 1]);
          }}
          aria-label="Anterior"
          className="hidden sm:flex fixed left-4 lg:left-8 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-white items-center justify-center shadow-2xl cursor-pointer transition-transform hover:scale-105"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {hasNext && onSelectItem && (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onSelectItem(items[currentIdx + 1]);
          }}
          aria-label="Siguiente"
          className="hidden sm:flex fixed right-4 lg:right-8 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-white items-center justify-center shadow-2xl cursor-pointer transition-transform hover:scale-105"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Main Studio Frame */}
      <div
        onClick={(ev) => ev.stopPropagation()}
        className={`relative z-10 w-full flex flex-col rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#171622]/95 to-[#0E0D15]/98 shadow-[0_32px_100px_rgba(0,0,0,0.85)] transition-all duration-200 ${
          fullscreenStage ? 'max-w-7xl h-[92vh]' : 'max-w-5xl'
        }`}
      >
        {/* Top Studio Bar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-white/[0.03]">
          <div className="min-w-0 flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-inner border border-white/15"
              style={{
                background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
              }}
            >
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                  {item.title || 'Vista ampliada'}
                </h3>
                {item.category && (
                  <span
                    className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-white/15 text-purple-100"
                    style={{ backgroundColor: `${accent}26` }}
                  >
                    {item.category}
                  </span>
                )}
              </div>
              {(item.client || item.year || items.length > 1) && (
                <p className="text-[11px] text-stone-400 truncate mt-0.5">
                  {[
                    item.client,
                    item.year,
                    currentIdx >= 0 && items.length > 1 ? `${currentIdx + 1} de ${items.length}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isVideo && (
              <>
                <button
                  type="button"
                  onClick={cycleZoom}
                  title={imageZoom === 1 ? 'Acercar detalle' : 'Restablecer zoom'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 text-xs text-stone-200 hover:text-white cursor-pointer transition-colors"
                >
                  {imageZoom === 1 ? (
                    <ZoomIn className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <ZoomOut className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span className="hidden sm:inline tabular-nums">
                    {imageZoom === 1 ? 'Acercar' : `${Math.round(imageZoom * 100)}%`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenStage((v) => !v)}
                  title={fullscreenStage ? 'Tamaño estándar' : 'Expandir marco'}
                  className="hidden sm:inline-flex p-1.5 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 text-stone-200 hover:text-white cursor-pointer"
                >
                  {fullscreenStage ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista ampliada"
              className="p-2 text-stone-300 hover:text-white bg-white/8 hover:bg-red-500/25 border border-white/10 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Presentation Stage */}
        <div
          className={`relative flex items-center justify-center overflow-auto ${
            fullscreenStage ? 'flex-1 min-h-0' : 'max-h-[76vh]'
          } ${isVideo ? 'bg-black' : 'bg-[#0B0A10] p-4 sm:p-8'}`}
          style={
            !isVideo
              ? {
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }
              : undefined
          }
        >
          {isVideo ? (
            parsedVideo?.kind === 'iframe' ? (
              <iframe
                src={parsedVideo.embedUrl}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={`w-full aspect-video border-0 ${
                  fullscreenStage ? 'h-full max-h-full' : 'max-h-[70vh]'
                }`}
              />
            ) : parsedVideo?.kind === 'external' ? (
              <div className="p-10 text-center space-y-4 text-white">
                <p className="text-sm text-stone-300">Video alojado en {parsedVideo.provider}</p>
                <a
                  href={parsedVideo.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 rounded-xl text-white shadow-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ver video online</span>
                </a>
              </div>
            ) : (
              <video
                src={resolveAssetUrl(targetVideoUrl)}
                controls
                autoPlay
                className={`w-full object-contain ${
                  fullscreenStage ? 'max-h-full' : 'max-h-[70vh]'
                }`}
              />
            )
          ) : (
            <div
              onClick={cycleZoom}
              className={`relative flex items-center justify-center transition-transform duration-300 ease-out ${
                imageZoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              style={{
                transform: `scale(${imageZoom})`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={imageSrc}
                alt={item.title}
                referrerPolicy="no-referrer"
                className={`rounded-xl object-contain shadow-[0_20px_70px_rgba(0,0,0,0.8)] ring-1 ring-white/15 bg-black/20 ${
                  fullscreenStage ? 'max-h-[76vh] max-w-full' : 'max-h-[68vh] max-w-full'
                }`}
              />
            </div>
          )}
        </div>

        {/* Bottom Studio Footer */}
        {isVideo && videoTarget && !videoTarget.isEmpty ? (
          <div className="px-5 py-3 border-t border-white/10 bg-[#12111A] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-stone-400">
              {item.videoActionLabel?.trim() || item.category || 'Opciones del video'}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={videoTarget.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-lg border border-white/10"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ver online</span>
              </a>
              <a
                href={videoTarget.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                download=""
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar video</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="px-5 py-2.5 border-t border-white/10 bg-[#12111A] flex items-center justify-between gap-3 text-[11px] text-stone-400">
            <span>
              Haz clic sobre la imagen para hacer zoom · <span className="text-stone-300">ESC</span> para cerrar
            </span>
            {(hasPrev || hasNext) && onSelectItem && (
              <div className="flex items-center gap-2 sm:hidden">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onSelectItem(items[currentIdx - 1])}
                  className="px-2.5 py-1 rounded bg-white/10 text-white disabled:opacity-30"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => hasNext && onSelectItem(items[currentIdx + 1])}
                  className="px-2.5 py-1 rounded bg-white/10 text-white disabled:opacity-30"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
