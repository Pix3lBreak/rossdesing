import React, { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Copy,
  ExternalLink,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Link2,
  Pencil,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createMediaFolder,
  createMediaLinkItem,
  deleteMediaFolder,
  deleteMediaItem,
  updateMediaItemMetadata,
  uploadMediaFile,
} from '../../services/storageService';
import type { MediaFolder, MediaItem } from '../../types/portfolio';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { isLikelyVideoUrl, parseVideoSource } from '../../utils/videoEmbed';

interface MediaLibraryViewProps {
  user: User;
  folders: MediaFolder[];
  items: MediaItem[];
  pickerMode?: boolean;
  filterTypeDefault?: 'all' | 'image' | 'logo' | 'video';
  onSelectMedia?: (item: MediaItem) => void;
  onClosePicker?: () => void;
}

export const MediaLibraryView: React.FC<MediaLibraryViewProps> = ({
  user,
  folders,
  items,
  pickerMode = false,
  filterTypeDefault = 'all',
  onSelectMedia,
  onClosePicker,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'logo' | 'video'>(filterTypeDefault);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'image' | 'logo' | 'video'>('image');
  const [editFolderId, setEditFolderId] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MediaItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPreview = (item: MediaItem) => {
    setPreviewItem(item);
    setEditName(item.name);
    setEditType(item.mediaType);
    setEditFolderId(item.folderId || '');
  };

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkType, setLinkType] = useState<'image' | 'logo' | 'video'>(
    filterTypeDefault === 'video' ? 'video' : 'image'
  );
  const [linkCategory, setLinkCategory] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const files = Array.from(fileList);

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(0);
        const uploaded = await uploadMediaFile(files[i], user, {
          folderId: selectedFolder !== 'all' ? selectedFolder : '',
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (pickerMode && files.length === 1 && onSelectMedia) {
          onSelectMedia(uploaded);
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir archivo.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createMediaFolder(newFolderName.trim(), user);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setSavingLink(true);
    setUploadError(null);
    try {
      const created = await createMediaLinkItem(
        {
          name: linkName.trim() || linkUrl.trim(),
          url: linkUrl.trim(),
          mediaType: linkType,
          folderId: selectedFolder !== 'all' ? selectedFolder : '',
          category: linkCategory.trim(),
        },
        user
      );
      setLinkUrl('');
      setLinkName('');
      setLinkCategory('');
      setShowLinkForm(false);
      if (pickerMode && onSelectMedia) {
        onSelectMedia(created);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo guardar el enlace.');
    } finally {
      setSavingLink(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedFolder !== 'all' && item.folderId !== selectedFolder) return false;
    if (mediaTypeFilter !== 'all' && item.mediaType !== mediaTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Estudio';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-[#141518] text-stone-100">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {pickerMode ? 'Seleccionar de Biblioteca Multimedia' : 'Biblioteca Multimedia'}
          </h2>
          <p className="text-xs text-stone-400">
            Almacenamiento en la nube · Fotos (PNG, JPG, GIF, WEBP, SVG), Videos MP4 y Enlaces (YouTube, Vimeo, Drive)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewFolder((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Nueva carpeta</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLinkForm((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
              showLinkForm
                ? 'bg-purple-600/30 border-purple-400 text-purple-100'
                : 'text-stone-100 bg-white/10 hover:bg-white/15 border-white/15'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Agregar enlace</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? `Subiendo ${uploadProgress}%` : 'Subir archivos'}</span>
          </button>

          {pickerMode && onClosePicker && (
            <button
              type="button"
              onClick={onClosePicker}
              className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Add External Link Inline Form */}
      {showLinkForm && (
        <form
          onSubmit={handleCreateLink}
          className="px-6 py-4 bg-purple-950/25 border-b border-purple-500/25 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Guardar video o imagen por enlace (YouTube, Vimeo, Google Drive, TikTok, MP4 o URL de foto)</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLinkForm(false)}
              className="text-xs text-stone-400 hover:text-white cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              value={linkUrl}
              onChange={(e) => {
                const val = e.target.value;
                setLinkUrl(val);
                if (isLikelyVideoUrl(val)) {
                  setLinkType('video');
                }
              }}
              placeholder="https://youtube.com/watch?v=... o https://.../imagen.jpg"
              className="md:col-span-5 px-3 py-2 text-xs bg-black/50 border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Título (ej. Reel Marca 2026)"
              className="md:col-span-3 px-3 py-2 text-xs bg-black/50 border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-500"
            />
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as 'image' | 'logo' | 'video')}
              className="md:col-span-2 px-2.5 py-2 text-xs bg-black/50 border border-white/15 rounded-lg text-white"
            >
              <option value="video">Video / Link</option>
              <option value="image">Fotografía</option>
              <option value="logo">Logotipo</option>
            </select>
            <button
              type="submit"
              disabled={savingLink}
              className="md:col-span-2 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
            >
              {savingLink ? 'Guardando...' : 'Guardar enlace'}
            </button>
          </div>
          <input
            type="text"
            value={linkCategory}
            onChange={(e) => setLinkCategory(e.target.value)}
            placeholder="Categoría opcional (ej. Reels, Branding, Social Media)"
            className="w-full md:w-72 px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-stone-200 focus:outline-none focus:border-amber-500"
          />
        </form>
      )}

      {/* Create Folder Inline Form */}
      {showNewFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="px-6 py-3 bg-white/[0.03] border-b border-white/10 flex items-center gap-3"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nombre de la carpeta (ej. Logofolios 2026)"
            className="flex-1 max-w-sm px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-semibold bg-white text-stone-900 rounded-lg cursor-pointer"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => setShowNewFolder(false)}
            className="px-3 py-1.5 text-xs text-stone-400 hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      )}

      {uploadError && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-4">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="text-red-300 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="px-6 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedFolder('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
              selectedFolder === 'all' ? 'bg-white text-stone-900' : 'text-stone-300 hover:bg-white/5'
            }`}
          >
            Todas ({items.length})
          </button>
          {folders.map((folder) => (
            <div key={folder.id} className="inline-flex items-center group">
              <button
                type="button"
                onClick={() => setSelectedFolder(folder.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  selectedFolder === folder.id ? 'bg-white text-stone-900' : 'text-stone-300 hover:bg-white/5'
                }`}
              >
                {folder.name}
              </button>
              {!pickerMode && (
                <button
                  type="button"
                  title="Eliminar carpeta"
                  onClick={() => void deleteMediaFolder(folder.id)}
                  className="opacity-0 group-hover:opacity-100 -ml-1 mr-1 p-1 text-stone-500 hover:text-red-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/30 border border-white/10 rounded-lg p-0.5">
            {(['all', 'image', 'logo', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMediaTypeFilter(t)}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                  mediaTypeFilter === t ? 'bg-white/15 text-white font-medium' : 'text-stone-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'Todo' : t === 'image' ? 'Fotos' : t === 'logo' ? 'Logos' : 'Videos'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar archivo..."
              className="pl-8 pr-3 py-1.5 text-xs bg-black/30 border border-white/10 rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone + Grid */}
      <div
        className={`flex-1 overflow-y-auto p-6 transition-colors ${
          dragOver ? 'bg-amber-500/10 ring-2 ring-inset ring-amber-500' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        {filteredItems.length === 0 ? (
          <div className="h-64 border border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center text-center p-6">
            <ImageIcon className="w-9 h-9 text-stone-500 mb-3" />
            <p className="text-sm font-medium text-stone-200">No hay archivos en esta vista</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm">
              Arrastra fotografías, logotipos PNG/SVG o videos MP4 aquí, o haz clic en “Subir archivos”.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group bg-[#1B1D21] border border-white/10 rounded-xl overflow-hidden flex flex-col"
              >
                <div
                  onClick={() => (pickerMode && onSelectMedia ? onSelectMedia(item) : openPreview(item))}
                  className="aspect-[4/3] bg-black/40 relative overflow-hidden cursor-pointer"
                >
                  {item.mediaType === 'video' ? (
                    (() => {
                      const parsed = parseVideoSource(item.url);
                      if (parsed.kind === 'iframe' && parsed.thumbnailUrl) {
                        return (
                          <div className="w-full h-full relative bg-stone-900">
                            <img
                              src={parsed.thumbnailUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover opacity-80"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30">
                              <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shadow">
                                <Play className="w-4 h-4 ml-0.5" />
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/75 text-amber-300">
                                {parsed.provider}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-stone-300 bg-stone-900">
                          <Film className="w-7 h-7 text-amber-400" />
                          <span className="text-[11px] uppercase tracking-wider">
                            {parsed.kind === 'iframe' || parsed.kind === 'external'
                              ? parsed.provider
                              : 'Video MP4'}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <img
                      src={resolveAssetUrl(item.url)}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${
                        item.mediaType === 'logo' ? 'object-contain p-3 bg-stone-800/50' : 'object-cover'
                      } transition-transform duration-200 group-hover:scale-105`}
                    />
                  )}

                  {pickerMode && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-md">
                        Seleccionar
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-stone-100 truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5 tabular-nums">
                      {item.mediaType.toUpperCase()} · {formatBytes(item.sizeBytes)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    {pickerMode && onSelectMedia ? (
                      <button
                        type="button"
                        onClick={() => onSelectMedia(item)}
                        className="w-full py-1 text-xs font-semibold bg-white/10 hover:bg-amber-600 text-white rounded-md cursor-pointer transition-colors"
                      >
                        Usar archivo
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Editar / Previsualizar"
                            onClick={() => openPreview(item)}
                            className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Copiar enlace"
                            onClick={async () => {
                              await navigator.clipboard.writeText(item.url);
                              setCopiedId(item.id);
                              setTimeout(() => setCopiedId(null), 1500);
                            }}
                            className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          title="Eliminar archivo"
                          onClick={() => setConfirmDelete(item)}
                          className="p-1.5 text-stone-400 hover:text-red-400 rounded hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="max-w-4xl w-full bg-[#1A1B1F] border border-white/10 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white truncate">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{previewItem.name}</span>
              </div>
              <button type="button" onClick={() => setPreviewItem(null)} className="text-stone-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center max-h-[60vh]">
              {previewItem.mediaType === 'video' ? (
                (() => {
                  const parsed = parseVideoSource(previewItem.url);
                  if (parsed.kind === 'iframe') {
                    return (
                      <iframe
                        src={parsed.embedUrl}
                        title={previewItem.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full aspect-video max-h-[55vh] border-0 rounded"
                      />
                    );
                  }
                  if (parsed.kind === 'external') {
                    return (
                      <div className="py-12 text-center space-y-3">
                        <p className="text-xs text-stone-300">Enlace externo ({parsed.provider})</p>
                        <a
                          href={parsed.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir enlace</span>
                        </a>
                      </div>
                    );
                  }
                  return (
                    <video src={resolveAssetUrl(previewItem.url)} controls autoPlay className="max-h-[55vh] w-full" />
                  );
                })()
              ) : (
                <img
                  src={resolveAssetUrl(previewItem.url)}
                  alt={previewItem.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[55vh] object-contain"
                />
              )}
            </div>
            {!pickerMode && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!previewItem) return;
                  setSavingMeta(true);
                  try {
                    const cleanName = editName.trim() || previewItem.name;
                    await updateMediaItemMetadata(previewItem.id, {
                      name: cleanName,
                      mediaType: editType,
                      folderId: editFolderId,
                    });
                    setPreviewItem(null);
                  } finally {
                    setSavingMeta(false);
                  }
                }}
                className="px-5 py-3.5 border-t border-white/10 bg-[#141518] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="text-[11px] text-stone-400 block mb-1">Nombre del archivo</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/15 rounded-lg text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[11px] text-stone-400 block mb-1">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as 'image' | 'logo' | 'video')}
                    className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/15 rounded-lg text-white"
                  >
                    <option value="image">Foto / Imagen</option>
                    <option value="logo">Logo de empresa</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-stone-400 block mb-1">Carpeta</label>
                  <select
                    value={editFolderId}
                    onChange={(e) => setEditFolderId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-black/50 border border-white/15 rounded-lg text-white"
                  >
                    <option value="">Sin carpeta</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-1.5">
                  <button
                    type="submit"
                    disabled={savingMeta}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {savingMeta ? '...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => {
                      const target = previewItem;
                      setPreviewItem(null);
                      setConfirmDelete(target);
                    }}
                    className="p-1.5 text-red-400 hover:bg-red-950/60 border border-red-500/30 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Eliminar archivo</h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              ¿Deseas eliminar <strong className="text-white">{confirmDelete.name}</strong> de la biblioteca multimedia? Las páginas que usen esta URL podrían dejar de mostrar la imagen.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteMediaItem(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
