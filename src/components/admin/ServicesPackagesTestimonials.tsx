import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteDraftPackage,
  deleteDraftService,
  deleteDraftTestimonial,
  saveDraftPackage,
  saveDraftService,
  saveDraftTestimonial,
} from '../../services/portfolioService';
import type {
  MediaFolder,
  MediaItem,
  PackageItem,
  ServiceItem,
  TestimonialItem,
} from '../../types/portfolio';
import { MediaLibraryView } from './MediaLibraryView';

// ==========================================
// 1. SERVICES MANAGER
// ==========================================
export const ServicesManager: React.FC<{
  user: User;
  services: ServiceItem[];
}> = ({ user, services }) => {
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [deliverablesText, setDeliverablesText] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const openEditor = (srv?: ServiceItem) => {
    const item: ServiceItem = srv || {
      id: `srv_${Date.now()}`,
      number: String(services.length + 1).padStart(2, '0'),
      title: '',
      description: '',
      category: 'Diseño',
      deliverables: [],
      visible: true,
      order: services.length + 1,
    };
    setEditing(item);
    setDeliverablesText((item.deliverables || []).join('\n'));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveDraftService(
      {
        ...editing,
        deliverables: deliverablesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      },
      user
    );
    setEditing(null);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-stone-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Servicios</h1>
          <p className="text-xs text-stone-400 mt-1">
            Sincronizados automáticamente con la página 03 (Servicios) del portafolio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          <button
            type="button"
            onClick={() => openEditor()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar servicio</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((srv) => (
          <div
            key={srv.id}
            className="bg-[#17181B] border border-white/10 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400">{srv.number || '—'} · {srv.category}</span>
                <span className={`text-[11px] ${srv.visible ? 'text-emerald-400' : 'text-stone-500'}`}>
                  {srv.visible ? 'Visible' : 'Oculto'}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white">{srv.title}</h3>
              <p className="text-xs text-stone-300 leading-relaxed">{srv.description}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveDraftService({ ...srv, visible: !srv.visible }, user)}
                  className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                >
                  {srv.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteDraftService(srv.id)}
                  className="p-1.5 text-stone-400 hover:text-red-400 rounded hover:bg-white/5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openEditor(srv)}
                className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
              >
                Editar servicio
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="max-w-lg w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Editar Servicio</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-stone-400">Número</label>
                <input
                  type="text"
                  value={editing.number || ''}
                  onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Categoría</label>
                <input
                  type="text"
                  value={editing.category || ''}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Orden</label>
                <input
                  type="number"
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg text-white tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-stone-400">Nombre del servicio</label>
              <input
                type="text"
                required
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-400">Descripción</label>
              <textarea
                rows={3}
                required
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-400">Entregables (uno por línea)</label>
              <textarea
                rows={3}
                value={deliverablesText}
                onChange={(e) => setDeliverablesText(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs text-stone-300">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg cursor-pointer">
                Guardar servicio
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. PACKAGES & PRICING MANAGER
// ==========================================
export const PackagesManager: React.FC<{
  user: User;
  packages: PackageItem[];
  mediaFolders: MediaFolder[];
  mediaItems: MediaItem[];
}> = ({ user, packages, mediaFolders, mediaItems }) => {
  const [catFilter, setCatFilter] = useState<'all' | 'branding' | 'social' | 'video' | 'custom'>('all');
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const [featuresText, setFeaturesText] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const openEditor = (pkg?: PackageItem) => {
    const item: PackageItem = pkg || {
      id: `pkg_${Date.now()}`,
      category: catFilter === 'all' ? 'branding' : catFilter,
      name: '',
      description: '',
      price: '',
      currency: 'USD',
      billingPeriod: 'Pago único',
      imageUrl: '',
      features: [],
      promoLabel: '',
      isPopular: false,
      visible: true,
      order: packages.length + 1,
    };
    setEditing(item);
    setFeaturesText((item.features || []).join('\n'));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveDraftPackage(
      {
        ...editing,
        features: featuresText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      },
      user
    );
    setEditing(null);
  };

  const filtered = catFilter === 'all' ? packages : packages.filter((p) => p.category === catFilter);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Paquetes y Precios</h1>
          <p className="text-xs text-stone-400 mt-1">
            Configura tus precios reales, moneda, características y etiquetas promocionales. Se actualizan automáticamente en las páginas 06, 07 y 08.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo paquete</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'branding', label: 'Identidad Visual (Pág. 06)' },
          { id: 'social', label: 'Diseño para Redes (Pág. 07)' },
          { id: 'video', label: 'Edición de Video (Pág. 08)' },
          { id: 'custom', label: 'Otros' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatFilter(c.id as typeof catFilter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap ${
              catFilter === c.id ? 'bg-white text-stone-900' : 'bg-white/5 text-stone-300 hover:bg-white/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filtered.map((pkg) => (
          <div
            key={pkg.id}
            className={`bg-[#17181B] border rounded-xl p-5 flex flex-col justify-between gap-4 ${
              pkg.isPopular ? 'border-amber-500/60' : 'border-white/10'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wider text-amber-400 font-semibold">
                  {pkg.category} {pkg.promoLabel ? `· ${pkg.promoLabel}` : ''}
                </span>
                {pkg.isPopular && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Star className="w-3 h-3 fill-amber-300" /> Destacado
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white">{pkg.name}</h3>
              <div className="text-xl font-bold tabular-nums text-white">
                {pkg.price ? `${pkg.currency} ${pkg.price}` : 'A consultar (sin precio definido)'}
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">{pkg.description}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void saveDraftPackage({ ...pkg, visible: !pkg.visible }, user)}
                  className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                >
                  {pkg.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-amber-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteDraftPackage(pkg.id)}
                  className="p-1.5 text-stone-400 hover:text-red-400 rounded hover:bg-white/5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openEditor(pkg)}
                className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
              >
                Editar paquete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Configurar Paquete</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-stone-400">Categoría</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as PackageItem['category'] })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                >
                  <option value="branding">Identidad Visual (Pág. 06)</option>
                  <option value="social">Diseño para Redes (Pág. 07)</option>
                  <option value="video">Edición de Video (Pág. 08)</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Orden de presentación</label>
                <input
                  type="number"
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-stone-400">Nombre del paquete</label>
              <input
                type="text"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-stone-400">Precio (dejar vacío = A consultar)</label>
                <input
                  type="text"
                  placeholder="Ej. 450"
                  value={editing.price || ''}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Moneda</label>
                <input
                  type="text"
                  value={editing.currency}
                  onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Modalidad / Ciclo</label>
                <input
                  type="text"
                  placeholder="Mensual / Pago único"
                  value={editing.billingPeriod || ''}
                  onChange={(e) => setEditing({ ...editing, billingPeriod: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] text-stone-400">Etiqueta promocional (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Recomendado"
                  value={editing.promoLabel || ''}
                  onChange={(e) => setEditing({ ...editing, promoLabel: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-stone-200 mt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.isPopular}
                  onChange={(e) => setEditing({ ...editing, isPopular: e.target.checked })}
                  className="accent-amber-500"
                />
                <span>Destacar como más popular</span>
              </label>
            </div>

            <div>
              <label className="text-[11px] text-stone-400">Descripción</label>
              <textarea
                rows={2}
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-stone-400">Características incluidas (una por línea)</label>
              <textarea
                rows={4}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 text-xs text-stone-300">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>{editing.imageUrl ? 'Imagen asignada' : 'Sin imagen opcional'}</span>
              </div>
              <div className="flex items-center gap-2">
                {editing.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, imageUrl: '' })}
                    className="text-xs text-red-400 hover:underline cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
                >
                  Elegir imagen
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs text-stone-300">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg cursor-pointer">
                Guardar paquete
              </button>
            </div>
          </form>
        </div>
      )}

      {showMediaPicker && editing && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[80vh] rounded-2xl overflow-hidden border border-white/15">
            <MediaLibraryView
              user={user}
              folders={mediaFolders}
              items={mediaItems}
              pickerMode={true}
              onClosePicker={() => setShowMediaPicker(false)}
              onSelectMedia={(item) => {
                setEditing({ ...editing, imageUrl: item.url });
                setShowMediaPicker(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. TESTIMONIALS MANAGER
// ==========================================
export const TestimonialsManager: React.FC<{
  user: User;
  testimonials: TestimonialItem[];
  mediaFolders: MediaFolder[];
  mediaItems: MediaItem[];
}> = ({ user, testimonials, mediaFolders, mediaItems }) => {
  const [editing, setEditing] = useState<TestimonialItem | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const openEditor = (item?: TestimonialItem) => {
    setEditing(
      item || {
        id: `test_${Date.now()}`,
        clientName: '',
        clientRole: '',
        company: '',
        quote: '',
        resultMetric: '',
        avatarUrl: '',
        visible: true,
        order: testimonials.length + 1,
      }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveDraftTestimonial(editing, user);
    setEditing(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-stone-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Testimonios</h1>
          <p className="text-xs text-stone-400 mt-1">
            Administra opiniones verificadas de clientes. Se muestran automáticamente en la página 14.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo testimonio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="bg-[#17181B] border border-white/10 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              {t.resultMetric && (
                <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
                  {t.resultMetric}
                </div>
              )}
              <p className="text-xs text-stone-200 leading-relaxed italic">“{t.quote}”</p>
              <div>
                <div className="text-sm font-semibold text-white">{t.clientName}</div>
                <div className="text-xs text-stone-400">
                  {[t.clientRole, t.company].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void saveDraftTestimonial({ ...t, visible: !t.visible }, user)}
                  className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                >
                  {t.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteDraftTestimonial(t.id)}
                  className="p-1.5 text-stone-400 hover:text-red-400 rounded hover:bg-white/5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openEditor(t)}
                className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="max-w-lg w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Editar Testimonio</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-stone-400">Nombre del cliente</label>
                <input
                  type="text"
                  required
                  value={editing.clientName}
                  onChange={(e) => setEditing({ ...editing, clientName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Cargo</label>
                <input
                  type="text"
                  value={editing.clientRole || ''}
                  onChange={(e) => setEditing({ ...editing, clientRole: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-stone-400">Empresa / Marca</label>
                <input
                  type="text"
                  value={editing.company || ''}
                  onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-400">Resultado destacado</label>
                <input
                  type="text"
                  value={editing.resultMetric || ''}
                  onChange={(e) => setEditing({ ...editing, resultMetric: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-stone-400">Testimonio</label>
              <textarea
                rows={4}
                required
                value={editing.quote}
                onChange={(e) => setEditing({ ...editing, quote: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10">
              <span className="text-xs text-stone-300">
                {editing.avatarUrl ? 'Foto de cliente asignada' : 'Sin fotografía (usa iniciales)'}
              </span>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
              >
                Elegir foto
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs text-stone-300">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg cursor-pointer">
                Guardar testimonio
              </button>
            </div>
          </form>
        </div>
      )}

      {showPicker && editing && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[80vh] rounded-2xl overflow-hidden border border-white/15">
            <MediaLibraryView
              user={user}
              folders={mediaFolders}
              items={mediaItems}
              pickerMode={true}
              onClosePicker={() => setShowPicker(false)}
              onSelectMedia={(item) => {
                setEditing({ ...editing, avatarUrl: item.url });
                setShowPicker(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
