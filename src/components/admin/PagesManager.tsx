import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  deleteDraftPage,
  reorderDraftPages,
  saveDraftPage,
} from '../../services/portfolioService';
import type {
  PackageItem,
  PortfolioConfig,
  PortfolioPage,
  ServiceItem,
  TestimonialItem,
} from '../../types/portfolio';
import { SlideRenderer } from '../canvas/SlideRenderer';

interface PagesManagerProps {
  user: User;
  config: PortfolioConfig;
  pages: PortfolioPage[];
  services: ServiceItem[];
  packages: PackageItem[];
  testimonials: TestimonialItem[];
  onEditPage: (pageId: string) => void;
}

export const PagesManager: React.FC<PagesManagerProps> = ({
  user,
  config,
  pages,
  services,
  packages,
  testimonials,
  onEditPage,
}) => {
  const [confirmDelete, setConfirmDelete] = useState<PortfolioPage | null>(null);
  const [alsoDeletePublished, setAlsoDeletePublished] = useState(true);
  const [deletingPage, setDeletingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleToggleVisible = async (page: PortfolioPage) => {
    await saveDraftPage({ ...page, visible: !page.visible }, user);
  };

  const handleDuplicate = async (page: PortfolioPage) => {
    const newId = `page_${Date.now()}`;
    const copy: PortfolioPage = {
      ...structuredClone(page),
      id: newId,
      order: pages.length + 1,
      slug: `${page.slug}-${pages.length + 1}`,
      title: `${page.title} (Copia)`,
    };
    await saveDraftPage(copy, user);
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await reorderDraftPages(next);
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim() || `Página ${pages.length + 1}`;
    const id = `page_${Date.now()}`;
    const slug = title
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
          content: 'Abre esta página en el Editor Visual para agregar fotografías, tarjetas, galerías o textos.',
          style: {
            fontSize: 16,
            lineHeight: 1.6,
            color: config.visualIdentity.mutedTextColor,
          },
        },
      ],
    };

    await saveDraftPage(newPage, user);
    setNewPageTitle('');
    setShowCreateModal(false);
    onEditPage(id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Administrar Páginas</h1>
          <p className="text-xs text-stone-400 mt-1">
            Reordena, oculta, duplica, crea nuevas páginas o ábrelas en el editor visual 16:9.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva página</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            className={`bg-[#17181B] border rounded-xl overflow-hidden flex flex-col ${
              page.visible ? 'border-white/10' : 'border-white/5 opacity-65'
            }`}
          >
            <div
              onClick={() => onEditPage(page.id)}
              className="aspect-video bg-black relative cursor-pointer group overflow-hidden"
            >
              <div className="pointer-events-none w-full h-full">
                <SlideRenderer
                  page={page}
                  identity={config.visualIdentity}
                  contact={config.contact}
                  services={services}
                  packages={packages}
                  testimonials={testimonials}
                />
              </div>
              <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-stone-900 rounded-lg text-xs font-semibold">
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Abrir en Editor Visual</span>
                </span>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono tabular-nums text-amber-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-sm font-semibold text-white truncate">{page.title}</h3>
                  </div>
                  <p className="text-xs text-stone-400 truncate mt-0.5">
                    {page.subtitle || `${page.elements.length} elementos`}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-medium shrink-0 ${
                    page.visible ? 'text-emerald-400' : 'text-stone-500'
                  }`}
                >
                  {page.visible ? 'Visible' : 'Oculta'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    title="Mover arriba"
                    onClick={() => void handleMove(idx, -1)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-white/5 rounded disabled:opacity-25 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === pages.length - 1}
                    title="Mover abajo"
                    onClick={() => void handleMove(idx, 1)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-white/5 rounded disabled:opacity-25 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title={page.visible ? 'Ocultar página' : 'Mostrar página'}
                    onClick={() => void handleToggleVisible(page)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-white/5 rounded cursor-pointer"
                  >
                    {page.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                  <button
                    type="button"
                    title="Duplicar página"
                    onClick={() => void handleDuplicate(page)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-white/5 rounded cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pages.length <= 1}
                    title={pages.length <= 1 ? 'Debe quedar al menos 1 página' : 'Eliminar página'}
                    onClick={() => {
                      setAlsoDeletePublished(true);
                      setConfirmDelete(page);
                    }}
                    className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-white/5 rounded cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onEditPage(page.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-md cursor-pointer"
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePage}
            className="max-w-md w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-white">Crear nueva página 16:9</h3>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-400">Título de la página</label>
              <input
                type="text"
                required
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="Ej. 17. Casos de Éxito"
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs text-stone-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
              >
                Crear y editar
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1B1D21] border border-white/10 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Eliminar página</h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              ¿Confirmas que deseas eliminar <strong className="text-white">{confirmDelete.title}</strong>? Esta acción eliminará sus elementos del borrador.
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
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs text-stone-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingPage}
                onClick={async () => {
                  setDeletingPage(true);
                  try {
                    await deleteDraftPage(confirmDelete.id, { alsoDeletePublished });
                    setConfirmDelete(null);
                  } finally {
                    setDeletingPage(false);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer disabled:opacity-60"
              >
                {deletingPage ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
