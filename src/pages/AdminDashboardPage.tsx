import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageSquareQuote,
  Palette,
  PenTool,
  Phone,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { ContactManager, PublishManager, SettingsManager, VisualIdentityManager } from '../components/admin/IdentityContactPublish';
import { MediaLibraryView } from '../components/admin/MediaLibraryView';
import { PagesManager } from '../components/admin/PagesManager';
import { PackagesManager, ServicesManager, TestimonialsManager } from '../components/admin/ServicesPackagesTestimonials';
import { VisualEditorWorkspace } from '../components/admin/VisualEditorWorkspace';
import { SlideRenderer } from '../components/canvas/SlideRenderer';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_PACKAGES,
  DEFAULT_PAGES,
  DEFAULT_PORTFOLIO_CONFIG,
  DEFAULT_SERVICES,
  DEFAULT_STUDIO_LOGO,
  DEFAULT_TESTIMONIALS,
} from '../data/defaultPortfolio';
import {
  bootstrapDraftAndPublishedIfEmpty,
  subscribeDraftPortfolio,
  subscribeVersions,
  type PortfolioBundle,
} from '../services/portfolioService';
import { subscribeMediaLibrary } from '../services/storageService';
import type {
  AdminSection,
  MediaFolder,
  MediaItem,
  PortfolioVersion,
} from '../types/portfolio';
import { resolveAssetUrl } from '../utils/assetUrl';

const NAV_ITEMS: Array<{ id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'editor', label: 'Editor visual', icon: PenTool },
  { id: 'pages', label: 'Administrar páginas', icon: Layers },
  { id: 'media', label: 'Biblioteca multimedia', icon: ImageIcon },
  { id: 'services', label: 'Servicios', icon: Briefcase },
  { id: 'packages', label: 'Paquetes y precios', icon: CreditCard },
  { id: 'testimonials', label: 'Testimonios', icon: MessageSquareQuote },
  { id: 'contact', label: 'Datos de contacto', icon: Phone },
  { id: 'identity', label: 'Identidad visual', icon: Palette },
  { id: 'settings', label: 'Configuración', icon: Settings },
  { id: 'publish', label: 'Publicación', icon: Rocket },
];

export const AdminDashboardPage: React.FC = () => {
  const {
    user,
    loading,
    isAdmin,
    adminUnlocked,
    authError,
    verifyAdminCredentials,
    loginWithGoogle,
    logout,
  } = useAuth();
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [editorPageId, setEditorPageId] = useState<string>('page_01');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [bundle, setBundle] = useState<PortfolioBundle>({
    config: DEFAULT_PORTFOLIO_CONFIG,
    pages: DEFAULT_PAGES,
    services: DEFAULT_SERVICES,
    packages: DEFAULT_PACKAGES,
    testimonials: DEFAULT_TESTIMONIALS,
    isFromFirestore: false,
  });
  const [mediaFolders, setMediaFolders] = useState<MediaFolder[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [versions, setVersions] = useState<PortfolioVersion[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [syncingDefaults, setSyncingDefaults] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !adminUnlocked || !user || !isAdmin) return;

    let cancelled = false;
    let unsubDraft: (() => void) | undefined;
    let unsubMedia: (() => void) | undefined;
    let unsubVersions: (() => void) | undefined;

    const initAdminWorkspace = async () => {
      setBootstrapping(true);
      setCloudError(null);
      try {
        await bootstrapDraftAndPublishedIfEmpty(user);
      } catch (err) {
        if (!cancelled) {
          setCloudError(err instanceof Error ? err.message : 'Error inicializando base de datos.');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }

      if (cancelled) return;

      unsubDraft = subscribeDraftPortfolio(
        (data) => {
          if (!cancelled) setBundle(data);
        },
        (err) => {
          if (!cancelled) setCloudError(err.message);
        }
      );

      unsubMedia = subscribeMediaLibrary(
        (folders) => {
          if (!cancelled) setMediaFolders(folders);
        },
        (items) => {
          if (!cancelled) setMediaItems(items);
        },
        (err) => {
          if (!cancelled) setCloudError(err.message);
        }
      );

      unsubVersions = subscribeVersions(
        (vers) => {
          if (!cancelled) setVersions(vers);
        },
        (err) => {
          if (!cancelled) setCloudError(err.message);
        }
      );
    };

    void initAdminWorkspace();

    return () => {
      cancelled = true;
      unsubDraft?.();
      unsubMedia?.();
      unsubVersions?.();
    };
  }, [loading, adminUnlocked, user, isAdmin]);

  const handleSyncPortfolioToCloud = async () => {
    if (!user) return;
    setSyncingDefaults(true);
    setCloudError(null);
    try {
      await bootstrapDraftAndPublishedIfEmpty(user);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'No se pudo sincronizar el portafolio en Firebase.');
    } finally {
      setSyncingDefaults(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#101113] text-stone-200 flex items-center justify-center">
        <div className="text-sm text-stone-400">Verificando sesión administrativa...</div>
      </div>
    );
  }

  const handleAdminFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = verifyAdminCredentials(loginUsername, loginPassword);
    if (ok && !user) {
      void loginWithGoogle();
    }
  };

  if (!adminUnlocked || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#101113] text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#17181B] border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl">
          {/* Admin Brand Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 p-2 rounded-2xl bg-white border border-purple-200/70 flex items-center justify-center shadow-lg">
              <img
                src={resolveAssetUrl(bundle.config.visualIdentity.logoUrl) || DEFAULT_STUDIO_LOGO}
                alt="Logo Administrador"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Panel Administrativo</span>
            </div>
            <h1 className="text-2xl font-semibold text-white">PORTFOLIO STUDIO PRO</h1>
            <p className="text-xs text-stone-400 leading-relaxed">
              Acceso privado para modificar todas las imágenes, textos, precios, servicios y diseño del portafolio.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words select-all">
              {authError}
            </div>
          )}

          {!adminUnlocked ? (
            <form onSubmit={handleAdminFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-stone-300">Usuario</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="ADMIN"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#101113] border border-white/15 rounded-xl text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-stone-300">Contraseña</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#101113] border border-white/15 rounded-xl text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shadow-lg"
              >
                Ingresar al Panel
              </button>
            </form>
          ) : !user ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200">
                Credenciales <strong>ADMIN</strong> verificadas. Inicia sesión con Google usando <strong>rossdsing@gmail.com</strong> para sincronizar cambios con Firebase.
              </div>
              <button
                type="button"
                onClick={() => void loginWithGoogle()}
                className="w-full py-3 px-4 bg-white hover:bg-stone-200 text-stone-900 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Continuar con Google (rossdsing@gmail.com)
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-stone-300">
                Sesión iniciada como <strong>{user.email}</strong> (sin permisos de administrador en Firebase).
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-xl cursor-pointer"
              >
                Cerrar sesión e intentar con otra cuenta
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
            <Link to="/" className="hover:text-white transition-colors">
              ← Volver al Portafolio Web
            </Link>
            <span>Usuario: ADMIN</span>
          </div>
        </div>
      </div>
    );
  }

  const openPageInEditor = (pageId: string) => {
    setEditorPageId(pageId);
    setSection('editor');
  };

  return (
    <div className="h-screen bg-[#111214] text-stone-100 flex overflow-hidden">
      {/* Dark Studio Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#141518] border-r border-white/10 flex flex-col justify-between transition-transform lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                <img
                  src={resolveAssetUrl(bundle.config.visualIdentity.logoUrl) || DEFAULT_STUDIO_LOGO}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xs font-semibold tracking-tight text-white truncate">
                PORTFOLIO STUDIO PRO
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-stone-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                      : 'text-stone-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-white/10 space-y-2 shrink-0">
          <Link
            to="/"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-200 bg-white/5 hover:bg-white/10 rounded-lg"
          >
            <span>Ver Portafolio Público</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate">{user.displayName || 'Admin'}</div>
              <div className="text-[11px] text-stone-400 truncate">{user.email}</div>
            </div>
            <button
              type="button"
              title="Cerrar sesión"
              onClick={() => void logout()}
              className="p-1.5 text-stone-400 hover:text-white rounded-md hover:bg-white/10 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Mobile Bar */}
        <header className="h-12 px-4 border-b border-white/10 bg-[#141518] flex items-center justify-between lg:hidden shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-stone-300 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-white">
            {NAV_ITEMS.find((n) => n.id === section)?.label}
          </span>
          <button
            type="button"
            onClick={() => setSection('publish')}
            className="px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white rounded-md"
          >
            Publicar
          </button>
        </header>

        {cloudError && (() => {
          let parsedInfo: { error?: string; operationType?: string; path?: string; authInfo?: { email?: string; emailVerified?: boolean } } | null = null;
          try {
            parsedInfo = JSON.parse(cloudError);
          } catch {
            parsedInfo = null;
          }
          return (
            <div className="px-6 py-3 bg-red-950/75 border-b border-red-500/40 text-xs text-red-200 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1 break-words">
                {parsedInfo ? (
                  <>
                    <div className="font-semibold text-red-100">
                      Error de Firebase: {parsedInfo.error || 'Permisos insuficientes'}
                      {parsedInfo.path ? ` · Ruta: ${parsedInfo.path}` : ''}
                      {parsedInfo.operationType ? ` · Operación: ${parsedInfo.operationType}` : ''}
                    </div>
                    <div className="text-[11px] text-red-300/90 font-mono break-all select-all">
                      {cloudError}
                    </div>
                  </>
                ) : (
                  <span className="break-words select-all">{cloudError}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={syncingDefaults}
                  onClick={() => void handleSyncPortfolioToCloud()}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {syncingDefaults ? 'Sincronizando...' : 'Reintentar sincronización'}
                </button>
                <button type="button" onClick={() => setCloudError(null)} className="text-red-300 hover:text-white cursor-pointer">
                  Cerrar
                </button>
              </div>
            </div>
          );
        })()}

        {!bootstrapping &&
          (bundle.pages.length === 0 ||
            bundle.services.length === 0 ||
            bundle.packages.length === 0 ||
            bundle.testimonials.length === 0) && (
            <div className="px-6 py-3 bg-amber-950/60 border-b border-amber-500/40 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-3">
              <span>
                Faltan secciones por cargar en Firebase ({bundle.pages.length} páginas, {bundle.services.length} servicios,{' '}
                {bundle.packages.length} paquetes). Haz clic para cargar todo el contenido editable del portafolio.
              </span>
              <button
                type="button"
                disabled={syncingDefaults}
                onClick={() => void handleSyncPortfolioToCloud()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingDefaults ? 'animate-spin' : ''}`} />
                <span>{syncingDefaults ? 'Cargando contenido...' : 'Cargar contenido del portafolio (16 páginas)'}</span>
              </button>
            </div>
          )}

        <main className="flex-1 overflow-y-auto min-h-0">
          {section === 'dashboard' && (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-white">Panel Administrativo</h1>
                  <p className="text-xs text-stone-400 mt-1">
                    {bootstrapping
                      ? 'Inicializando estructura de 16 páginas, servicios, paquetes y galería en Firebase...'
                      : 'Gestiona contenido, diseño 16:9, tarifas y publicación en tiempo real.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSection('editor')}
                    className="px-4 py-2 text-xs font-semibold bg-white text-stone-900 hover:bg-stone-200 rounded-lg cursor-pointer"
                  >
                    Abrir Editor Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('publish')}
                    className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
                  >
                    Publicar Cambios
                  </button>
                </div>
              </div>

              {/* Tabular Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Páginas totales', value: bundle.pages.length, sub: `${bundle.pages.filter((p) => p.visible).length} visibles` },
                  { label: 'Archivos multimedia', value: mediaItems.length, sub: `${mediaFolders.length} carpetas` },
                  { label: 'Servicios', value: bundle.services.length, sub: 'Sincronizados Pág. 03' },
                  { label: 'Paquetes', value: bundle.packages.length, sub: 'Págs. 06, 07 y 08' },
                  { label: 'Testimonios', value: bundle.testimonials.length, sub: 'Sincronizados Pág. 14' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#17181B] border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-stone-400">{stat.label}</div>
                    <div className="text-2xl font-bold tabular-nums text-white mt-1">{stat.value}</div>
                    <div className="text-[11px] text-stone-500 mt-1">{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Quick Access Grid of 16 Slides */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Vista rápida de páginas del portafolio</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSection('pages')}
                    className="text-xs text-amber-400 hover:underline cursor-pointer"
                  >
                    Administrar todas →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {bundle.pages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openPageInEditor(p.id)}
                      className="text-left bg-[#17181B] border border-white/10 hover:border-amber-500/50 rounded-xl overflow-hidden transition-colors cursor-pointer group"
                    >
                      <div className="aspect-video overflow-hidden pointer-events-none">
                        <SlideRenderer
                          page={p}
                          identity={bundle.config.visualIdentity}
                          contact={bundle.config.contact}
                          services={bundle.services}
                          packages={bundle.packages}
                          testimonials={bundle.testimonials}
                        />
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-stone-200 group-hover:text-white truncate">
                          {p.title}
                        </span>
                        <span className="text-[11px] text-stone-500 shrink-0">
                          {p.visible ? 'Visible' : 'Oculta'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'editor' && (
            <VisualEditorWorkspace
              user={user}
              config={bundle.config}
              pages={bundle.pages}
              services={bundle.services}
              packages={bundle.packages}
              testimonials={bundle.testimonials}
              mediaFolders={mediaFolders}
              mediaItems={mediaItems}
              initialPageId={editorPageId}
              onPublishClick={() => setSection('publish')}
            />
          )}

          {section === 'pages' && (
            <PagesManager
              user={user}
              config={bundle.config}
              pages={bundle.pages}
              services={bundle.services}
              packages={bundle.packages}
              testimonials={bundle.testimonials}
              onEditPage={openPageInEditor}
            />
          )}

          {section === 'media' && (
            <MediaLibraryView
              user={user}
              folders={mediaFolders}
              items={mediaItems}
            />
          )}

          {section === 'services' && (
            <ServicesManager user={user} services={bundle.services} />
          )}

          {section === 'packages' && (
            <PackagesManager
              user={user}
              packages={bundle.packages}
              mediaFolders={mediaFolders}
              mediaItems={mediaItems}
            />
          )}

          {section === 'testimonials' && (
            <TestimonialsManager
              user={user}
              testimonials={bundle.testimonials}
              mediaFolders={mediaFolders}
              mediaItems={mediaItems}
            />
          )}

          {section === 'contact' && (
            <ContactManager user={user} config={bundle.config} />
          )}

          {section === 'identity' && (
            <VisualIdentityManager user={user} bundle={bundle} />
          )}

          {section === 'settings' && (
            <SettingsManager user={user} config={bundle.config} />
          )}

          {section === 'publish' && (
            <PublishManager user={user} bundle={bundle} versions={versions} />
          )}
        </main>
      </div>
    </div>
  );
};
