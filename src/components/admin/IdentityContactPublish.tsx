import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  History,
  Rocket,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { DEFAULT_VISUAL_IDENTITY, FONT_OPTIONS } from '../../data/defaultPortfolio';
import {
  applyBrandTemplateToDraft,
  publishDraftToLive,
  restoreVersionToDraft,
  saveDraftConfig,
  saveDraftPage,
  type PortfolioBundle,
} from '../../services/portfolioService';
import { uploadMediaFile } from '../../services/storageService';
import type { PortfolioConfig, PortfolioVersion, VisualIdentity } from '../../types/portfolio';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { downloadSlideAsPng, exportSlidesToPdf } from '../../utils/exportPdf';
import { SlideRenderer } from '../canvas/SlideRenderer';

// ==========================================
// 1. CONTACT MANAGER
// ==========================================
export const ContactManager: React.FC<{
  user: User;
  config: PortfolioConfig;
}> = ({ user, config }) => {
  const [contact, setContact] = useState(config.contact);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContact(config.contact);
  }, [config.contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveDraftConfig(
        {
          ...config,
          studioName: contact.studioName || config.studioName,
          contact,
        },
        user
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-4xl mx-auto space-y-6 text-stone-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Datos de Contacto y Canales Comerciales</h1>
          <p className="text-xs text-stone-400 mt-1">
            Sincronizado con la Portada, los botones de paquetes y la página 16 (Contacto).
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Cambios guardados' : saving ? 'Guardando...' : 'Guardar contacto'}</span>
        </button>
      </div>

      <div className="bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-stone-400">Nombre comercial / Estudio</label>
            <input
              type="text"
              required
              value={contact.studioName}
              onChange={(e) => setContact({ ...contact, studioName: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">Nombre profesional</label>
            <input
              type="text"
              value={contact.professionalName}
              onChange={(e) => setContact({ ...contact, professionalName: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">Especialidad</label>
            <input
              type="text"
              value={contact.specialty}
              onChange={(e) => setContact({ ...contact, specialty: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">Ubicación / Cobertura</label>
            <input
              type="text"
              value={contact.location}
              onChange={(e) => setContact({ ...contact, location: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-stone-400">Correo electrónico comercial</label>
            <input
              type="email"
              placeholder="contacto@tuestudio.com"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">Número de WhatsApp (con código de país)</label>
            <input
              type="text"
              placeholder="Ej. 5215512345678"
              value={contact.whatsappNumber}
              onChange={(e) => setContact({ ...contact, whatsappNumber: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-stone-400">Mensaje predeterminado de WhatsApp</label>
          <textarea
            rows={2}
            value={contact.whatsappDefaultMessage}
            onChange={(e) => setContact({ ...contact, whatsappDefaultMessage: e.target.value })}
            className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
          />
        </div>

        <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-stone-400">Instagram URL</label>
            <input
              type="url"
              placeholder="https://instagram.com/..."
              value={contact.instagramUrl}
              onChange={(e) => setContact({ ...contact, instagramUrl: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">Facebook URL</label>
            <input
              type="url"
              placeholder="https://facebook.com/..."
              value={contact.facebookUrl}
              onChange={(e) => setContact({ ...contact, facebookUrl: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">TikTok URL</label>
            <input
              type="url"
              placeholder="https://tiktok.com/@..."
              value={contact.tiktokUrl}
              onChange={(e) => setContact({ ...contact, tiktokUrl: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-stone-400">Sitio Web URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={contact.websiteUrl}
              onChange={(e) => setContact({ ...contact, websiteUrl: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
            />
          </div>
        </div>
      </div>
    </form>
  );
};

// ==========================================
// 2. VISUAL IDENTITY MANAGER
// ==========================================
export const VisualIdentityManager: React.FC<{
  user: User;
  bundle: PortfolioBundle;
}> = ({ user, bundle }) => {
  const [identity, setIdentity] = useState<VisualIdentity>(bundle.config.visualIdentity);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [overwritePageBackgrounds, setOverwritePageBackgrounds] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadPct, setLogoUploadPct] = useState(0);
  const [logoUploadError, setLogoUploadError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIdentity(bundle.config.visualIdentity);
  }, [bundle.config.visualIdentity]);

  const handleDirectLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    setLogoUploading(true);
    setLogoUploadPct(0);
    setLogoUploadError('');
    try {
      const uploaded = await uploadMediaFile(file, user, {
        folderId: 'folder_branding',
        category: 'Logo',
        mediaTypeOverride: 'logo',
        onProgress: (pct) => setLogoUploadPct(pct),
      });
      setIdentity((prev) => ({ ...prev, logoUrl: uploaded.url }));
      setSavedMsg('Logo subido. Haz clic en "Aplicar identidad global" para guardarlo.');
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : 'No se pudo subir el logo.');
    } finally {
      setLogoUploading(false);
      setLogoUploadPct(0);
    }
  };

  const handleSaveGlobal = async (clearPageOverrides: boolean) => {
    setSaving(true);
    try {
      await saveDraftConfig({ ...bundle.config, visualIdentity: identity }, user);
      if (clearPageOverrides) {
        for (const p of bundle.pages) {
          if (p.backgroundColor || p.backgroundGradient || p.accentColorOverride) {
            await saveDraftPage(
              { ...p, backgroundColor: '', backgroundGradient: '', accentColorOverride: '' },
              user
            );
          }
        }
      }
      setSavedMsg(
        clearPageOverrides
          ? 'Aplicado globalmente (fondos individuales restablecidos)'
          : 'Identidad visual guardada'
      );
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Identidad Visual Global</h1>
          <p className="text-xs text-stone-400 mt-1">
            Controla logotipo, paleta de colores, tipografías, escala, botones y fondos decorativos de todo el portafolio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {savedMsg && <span className="text-xs text-emerald-400">{savedMsg}</span>}
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await applyBrandTemplateToDraft(user, false);
                setSavedMsg('Estilo Violeta y 16 páginas aplicados al borrador');
                setTimeout(() => setSavedMsg(''), 3000);
              } finally {
                setSaving(false);
              }
            }}
            className="px-3 py-2 text-xs text-purple-200 hover:text-white bg-purple-900/40 border border-purple-500/30 rounded-lg cursor-pointer"
          >
            Aplicar Estilo Violeta (16 págs.)
          </button>
          <button
            type="button"
            onClick={() => setIdentity(DEFAULT_VISUAL_IDENTITY)}
            className="px-3 py-2 text-xs text-stone-300 hover:text-white bg-white/5 rounded-lg cursor-pointer"
          >
            Restaurar paleta base
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveGlobal(overwritePageBackgrounds)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aplicar identidad global</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Paleta Cromática y Logotipo</h3>
            <label className="flex items-center gap-2 text-[11px] text-stone-400 cursor-pointer">
              <input
                type="checkbox"
                checked={overwritePageBackgrounds}
                onChange={(e) => setOverwritePageBackgrounds(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Sobrescribir fondos de páginas</span>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'primaryColor', label: 'Color Principal' },
              { key: 'secondaryColor', label: 'Color Secundario' },
              { key: 'accentColor', label: 'Color de Acento' },
              { key: 'backgroundColor', label: 'Fondo Lienzo' },
              { key: 'surfaceColor', label: 'Fondo Tarjetas' },
              { key: 'textColor', label: 'Texto Principal' },
            ].map((item) => (
              <div key={item.key} className="space-y-1.5">
                <label className="text-[11px] text-stone-400 block">{item.label}</label>
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-1.5">
                  <input
                    type="color"
                    value={identity[item.key as keyof VisualIdentity] as string}
                    onChange={(e) => setIdentity({ ...identity, [item.key]: e.target.value })}
                    className="w-8 h-7 rounded cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-stone-300">
                    {String(identity[item.key as keyof VisualIdentity])}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] text-stone-400">URL del Logotipo (o subir archivo)</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white rounded cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{logoUploading ? `Subiendo ${logoUploadPct}%` : identity.logoUrl ? 'Cambiar' : 'Subir logo'}</span>
                  </button>
                  {identity.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setIdentity({ ...identity, logoUrl: '' })}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-red-950/50 hover:bg-red-900/60 text-red-200 border border-red-500/30 rounded cursor-pointer"
                      title="Quitar logotipo"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    void handleDirectLogoUpload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                {identity.logoUrl && (
                  <div className="w-9 h-9 rounded-lg bg-white/95 border border-white/15 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={resolveAssetUrl(identity.logoUrl)}
                      alt="Logo del estudio"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <input
                  type="text"
                  placeholder="https://... o /assets/..."
                  value={identity.logoUrl || ''}
                  onChange={(e) => setIdentity({ ...identity, logoUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              {logoUploadError && (
                <p className="text-[11px] text-red-400 mt-1 break-words">{logoUploadError}</p>
              )}
            </div>
            <div>
              <label className="text-[11px] text-stone-400">Degradado Principal (CSS)</label>
              <input
                type="text"
                placeholder="linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)"
                value={identity.gradientBackground || ''}
                onChange={(e) => setIdentity({ ...identity, gradientBackground: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white">Tipografía y Escala</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-stone-400">Tipografía de Títulos</label>
                <select
                  value={identity.headingFont}
                  onChange={(e) => setIdentity({ ...identity, headingFont: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Tipografía de Párrafos</label>
                <select
                  value={identity.bodyFont}
                  onChange={(e) => setIdentity({ ...identity, bodyFont: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-stone-400">Escala ({Math.round(identity.baseFontScale * 100)}%)</label>
                <input
                  type="range"
                  min="0.9"
                  max="1.15"
                  step="0.05"
                  value={identity.baseFontScale}
                  onChange={(e) => setIdentity({ ...identity, baseFontScale: Number(e.target.value) })}
                  className="w-full mt-2.5 accent-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Estilo Botones</label>
                <select
                  value={identity.buttonStyle}
                  onChange={(e) => setIdentity({ ...identity, buttonStyle: e.target.value as VisualIdentity['buttonStyle'] })}
                  className="w-full mt-1 px-2.5 py-1.5 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                >
                  <option value="sharp">Recto (2px)</option>
                  <option value="soft">Suave (8px)</option>
                  <option value="pill">Cápsula</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Radio Tarjetas ({identity.borderRadius}px)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={identity.borderRadius}
                  onChange={(e) => setIdentity({ ...identity, borderRadius: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-1.5 text-xs bg-black/40 border border-white/15 rounded-lg text-white tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-stone-400">Fondo Decorativo</label>
                <select
                  value={identity.decorativeBackground}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      decorativeBackground: e.target.value as VisualIdentity['decorativeBackground'],
                    })
                  }
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                >
                  <option value="clean">Limpio</option>
                  <option value="editorial-lines">Líneas editoriales</option>
                  <option value="grid">Retícula sutil</option>
                  <option value="warm-glow">Resplandor ambiental</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Sombras</label>
                <select
                  value={identity.shadowStyle}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      shadowStyle: e.target.value as VisualIdentity['shadowStyle'],
                    })
                  }
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                >
                  <option value="none">Sin sombras</option>
                  <option value="subtle">Sutiles</option>
                  <option value="elevated">Elevadas</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Live 16:9 Identity Preview */}
        <div className="lg:col-span-6 space-y-3">
          <div className="text-xs font-medium text-stone-400">Vista previa en tiempo real (Portada)</div>
          <div className="aspect-video rounded-xl overflow-hidden border border-white/15 shadow-2xl">
            {bundle.pages[0] && (
              <SlideRenderer
                page={bundle.pages[0]}
                identity={identity}
                contact={bundle.config.contact}
                services={bundle.services}
                packages={bundle.packages}
                testimonials={bundle.testimonials}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. SETTINGS MANAGER
// ==========================================
export const SettingsManager: React.FC<{
  user: User;
  config: PortfolioConfig;
}> = ({ user, config }) => {
  const [studioName, setStudioName] = useState(config.studioName);
  const [tagline, setTagline] = useState(config.studioTagline || '');
  const [seoDesc, setSeoDesc] = useState(config.seoDescription || '');
  const [allowPublicPdf, setAllowPublicPdf] = useState(config.allowPublicPdfExport !== false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStudioName(config.studioName);
    setTagline(config.studioTagline || '');
    setSeoDesc(config.seoDescription || '');
    setAllowPublicPdf(config.allowPublicPdfExport !== false);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveDraftConfig(
      {
        ...config,
        studioName,
        studioTagline: tagline,
        seoDescription: seoDesc,
        allowPublicPdfExport: allowPublicPdf,
      },
      user
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="p-6 max-w-4xl mx-auto space-y-6 text-stone-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Configuración General</h1>
          <p className="text-xs text-stone-400 mt-1">
            Ajustes del sitio público, permisos de exportación y estado de seguridad en Firebase.
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Guardado' : 'Guardar configuración'}</span>
        </button>
      </div>

      <div className="bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs text-stone-400">Nombre del Portafolio</label>
          <input
            type="text"
            required
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="text-xs text-stone-400">Subtítulo / Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="text-xs text-stone-400">Descripción SEO para buscadores y enlaces compartidos</label>
          <textarea
            rows={3}
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
          />
        </div>
        <label className="flex items-center gap-3 pt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allowPublicPdf}
            onChange={(e) => setAllowPublicPdf(e.target.checked)}
            className="accent-amber-500"
          />
          <span className="text-xs text-stone-200">
            Permitir que los visitantes públicos descarguen el portafolio en PDF 16:9
          </span>
        </label>
      </div>

      <div className="bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-2.5 text-xs">
        <div className="font-semibold text-white">Seguridad y Control de Acceso Exclusivo</div>
        <p className="text-stone-400">
          Administrador autenticado con Firebase Auth: <strong className="text-stone-200">{user.email}</strong>
        </p>
        <p className="text-stone-400 leading-relaxed">
          El portafolio público (<span className="text-stone-200">/</span>) es exclusivamente de lectura y no muestra herramientas de edición. Solo tu cuenta administradora autorizada en Firebase puede ingresar a <span className="text-stone-200">/admin</span>, modificar textos, reemplazar imágenes y publicar cambios.
        </p>
      </div>
    </form>
  );
};

// ==========================================
// 4. PUBLISH & EXPORT MANAGER
// ==========================================
export const PublishManager: React.FC<{
  user: User;
  bundle: PortfolioBundle;
  versions: PortfolioVersion[];
}> = ({ user, bundle, versions }) => {
  const [label, setLabel] = useState(`Versión ${new Date().toLocaleDateString('es-ES')}`);
  const [notes, setNotes] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const exportStageRef = useRef<HTMLDivElement>(null);
  const visiblePages = bundle.pages.filter((p) => p.visible);
  const publicUrl = `${window.location.origin}/`;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishDraftToLive(bundle, user, label || 'Actualización', notes);
      setPublishDone(true);
      setNotes('');
      setTimeout(() => setPublishDone(false), 3000);
    } finally {
      setPublishing(false);
    }
  };

  const handleExportPdf = async () => {
    if (!exportStageRef.current || exportingPdf) return;
    setExportingPdf(true);
    setPdfProgress('Iniciando...');
    try {
      await new Promise((r) => setTimeout(r, 150));
      await exportSlidesToPdf(
        () => Array.from(exportStageRef.current?.querySelectorAll('[data-export-slide]') || []) as HTMLElement[],
        bundle.config.studioName || 'portafolio',
        (cur, tot) => setPdfProgress(`${cur}/${tot}`)
      );
    } finally {
      setExportingPdf(false);
      setPdfProgress('');
    }
  };

  const handleDownloadSinglePng = async (pageId: string, title: string) => {
    const el = exportStageRef.current?.querySelector(`[data-slide-id="${pageId}"]`) as HTMLElement | null;
    if (!el) return;
    await downloadSlideAsPng(el, title);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Publicación, Exportación y Versiones</h1>
          <p className="text-xs text-stone-400 mt-1">
            Publica tus borradores al enlace público, exporta el portafolio en PDF 16:9 o restaura versiones anteriores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(publicUrl);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-lg cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUrl ? 'Enlace copiado' : 'Copiar enlace público'}</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-lg"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir Portafolio Público</span>
          </Link>
        </div>
      </div>

      {/* Publish Action Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Publicar Cambios al Portafolio Vivo</h2>
            <span
              className={`text-xs font-medium ${
                bundle.config.hasUnpublishedChanges ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {bundle.config.hasUnpublishedChanges ? 'Cambios pendientes' : 'Al día con la versión pública'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-stone-400">Nombre de la versión</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400">Notas de actualización (opcional)</label>
              <input
                type="text"
                placeholder="Ej. Nuevos precios de branding y fotografías actualizadas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={publishing}
            onClick={() => void handlePublish()}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {publishDone ? <Check className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
            <span>
              {publishDone
                ? '¡Portafolio publicado correctamente!'
                : publishing
                ? 'Publicando versión...'
                : 'Publicar modificaciones ahora'}
            </span>
          </button>
        </div>

        {/* Export Tools Card */}
        <div className="lg:col-span-5 bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Exportación de Alta Calidad (16:9)</h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Genera un documento PDF panorámico con todas tus páginas visibles ({visiblePages.length}) o descarga imágenes individuales en PNG 2x.
          </p>

          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="w-full py-2.5 px-4 bg-white text-stone-900 hover:bg-stone-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{exportingPdf ? `Exportando PDF (${pdfProgress})` : 'Exportar Portafolio Completo a PDF'}</span>
          </button>

          <div className="pt-2 border-t border-white/10 max-h-40 overflow-y-auto space-y-1.5">
            <div className="text-[11px] text-stone-400 mb-1">Descargar página individual (PNG):</div>
            {visiblePages.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 bg-black/30 rounded">
                <span className="truncate">{p.title}</span>
                <button
                  type="button"
                  onClick={() => void handleDownloadSinglePng(p.id, p.title)}
                  className="text-amber-400 hover:underline shrink-0 cursor-pointer"
                >
                  PNG
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Version History */}
      <div className="bg-[#17181B] border border-white/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <h2 className="text-base font-semibold text-white">Historial de Versiones Publicadas</h2>
        </div>

        {versions.length === 0 ? (
          <p className="text-xs text-stone-400">
            Aún no hay historial guardado. Haz clic en “Publicar modificaciones ahora” para crear la primera instantánea restaurable.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {versions.map((ver) => (
              <div key={ver.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">{ver.label}</div>
                  <div className="text-xs text-stone-400">
                    {ver.snapshot.pages.length} páginas · {ver.notes || 'Instantánea guardada'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={restoringId === ver.id}
                  onClick={async () => {
                    setRestoringId(ver.id);
                    try {
                      await restoreVersionToDraft(ver, user);
                    } finally {
                      setRestoringId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{restoringId === ver.id ? 'Restaurando...' : 'Restaurar al borrador'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden 1280x720 Export Stage */}
      <div aria-hidden="true" className="fixed -left-[99999px] top-0 pointer-events-none">
        <div ref={exportStageRef}>
          {visiblePages.map((pg) => (
            <div
              key={pg.id}
              data-export-slide
              data-slide-id={pg.id}
              style={{ width: '1280px', height: '720px' }}
            >
              <SlideRenderer
                page={pg}
                identity={bundle.config.visualIdentity}
                contact={bundle.config.contact}
                services={bundle.services}
                packages={bundle.packages}
                testimonials={bundle.testimonials}
                fixedWidth={1280}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
