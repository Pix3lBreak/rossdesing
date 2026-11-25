import type {
  CanvasElement,
  ContactConfig,
  PackageItem,
  ServiceItem,
  TestimonialItem,
  VisualIdentity,
} from '../types/portfolio';

interface SplitContext {
  identity: VisualIdentity;
  contact: ContactConfig;
  services: ServiceItem[];
  packages: PackageItem[];
  testimonials: TestimonialItem[];
  accentColor?: string;
}

/**
 * Converts a grouped dynamic block (packages-grid, services-grid, testimonials-grid, contact-block)
 * into individual, freely movable/resizable/editable native canvas elements (shapes, headings, texts, buttons).
 */
export function splitDynamicBlockToElements(
  el: CanvasElement,
  ctx: SplitContext
): CanvasElement[] {
  const stamp = Date.now();
  const baseZ = el.zIndex || 2;
  const s = el.style || {};
  const radius = s.borderRadius ?? ctx.identity.borderRadius ?? 16;
  const accentColor = ctx.accentColor || ctx.identity.accentColor || '#8B3DFF';
  const primaryColor = ctx.identity.primaryColor || '#6D28D9';
  const results: CanvasElement[] = [];

  if (el.type === 'packages-grid') {
    const category = el.packageCategory || 'branding';
    const items = ctx.packages.filter((p) => p.visible && p.category === category).slice(0, 4);
    if (items.length === 0) return [];

    const gap = 16;
    const cols = Math.max(1, items.length);
    const cardW = Math.max(140, Math.floor((el.w - gap * (cols - 1)) / cols));
    const cardBg = s.backgroundColor && s.backgroundColor !== 'transparent' ? s.backgroundColor : '#FFFFFF';
    const cardText = s.color || '#3B0764';
    const ctaLabel = el.content?.trim() || 'Solicitar plan';

    items.forEach((pkg, idx) => {
      const cx = el.x + idx * (cardW + gap);
      const cy = el.y;
      const ch = el.h;
      const pad = 20;
      const innerW = Math.max(100, cardW - pad * 2);
      const prefix = `pkg_el_${stamp}_${idx}`;
      const isPopular = Boolean(pkg.isPopular);

      // 1. Card background shape
      results.push({
        id: `${prefix}_bg`,
        type: 'shape',
        name: `Tarjeta · ${pkg.name}`,
        x: cx,
        y: cy,
        w: cardW,
        h: ch,
        zIndex: baseZ,
        style: {
          backgroundColor: cardBg,
          borderColor: isPopular ? accentColor : s.borderColor || 'rgba(109,40,217,0.18)',
          borderWidth: isPopular ? 2 : 1,
          borderRadius: radius,
          shadow: isPopular ? 'lg' : 'md',
        },
      });

      let cursorY = cy + 18;

      // 2. Optional promo badge
      if (isPopular || pkg.promoLabel) {
        results.push({
          id: `${prefix}_badge`,
          type: 'text',
          name: `Etiqueta · ${pkg.name}`,
          x: cx + pad,
          y: cursorY,
          w: Math.min(innerW, 148),
          h: 24,
          zIndex: baseZ + 2,
          content: pkg.promoLabel || 'Más Popular',
          style: {
            fontSize: 11,
            fontWeight: '700',
            color: '#FFFFFF',
            backgroundColor: accentColor,
            borderRadius: 999,
            textAlign: 'center',
            padding: 4,
          },
        });
        cursorY += 30;
      }

      // 3. Plan title
      results.push({
        id: `${prefix}_title`,
        type: 'heading',
        name: `Título · ${pkg.name}`,
        x: cx + pad,
        y: cursorY,
        w: innerW,
        h: 34,
        zIndex: baseZ + 2,
        content: pkg.name.toUpperCase(),
        style: {
          fontSize: 17,
          fontWeight: '800',
          color: cardText,
          lineHeight: 1.15,
        },
      });
      cursorY += 34;

      // 4. Price + cycle
      const hasPrice = Boolean(pkg.price && pkg.price.trim().length > 0);
      const priceText = hasPrice
        ? pkg.currency === '$'
          ? `$${pkg.price}`
          : `${pkg.currency} ${pkg.price}`
        : 'A consultar';
      const priceLine = pkg.billingPeriod ? `${priceText}  / ${pkg.billingPeriod}` : priceText;

      results.push({
        id: `${prefix}_price`,
        type: 'heading',
        name: `Precio · ${pkg.name}`,
        x: cx + pad,
        y: cursorY,
        w: innerW,
        h: 40,
        zIndex: baseZ + 2,
        content: priceLine,
        style: {
          fontSize: hasPrice ? 24 : 20,
          fontWeight: '800',
          color: accentColor,
          lineHeight: 1.15,
        },
      });
      cursorY += 42;

      // 5. Description + features body
      const btnH = 38;
      const btnY = cy + ch - pad - btnH;
      const bodyH = Math.max(80, btnY - cursorY - 12);
      const featuresLines = (pkg.features || []).map((f) => `✓  ${f}`).join('\n');
      const fullBody = [pkg.description ? pkg.description.toUpperCase() : '', featuresLines]
        .filter(Boolean)
        .join('\n\n');

      results.push({
        id: `${prefix}_body`,
        type: 'text',
        name: `Detalles · ${pkg.name}`,
        x: cx + pad,
        y: cursorY,
        w: innerW,
        h: bodyH,
        zIndex: baseZ + 2,
        content: fullBody,
        style: {
          fontSize: 12,
          fontWeight: '500',
          color: cardText,
          lineHeight: 1.5,
        },
      });

      // 6. CTA Button
      results.push({
        id: `${prefix}_cta`,
        type: 'button',
        name: `Botón · ${pkg.name}`,
        x: cx + pad,
        y: btnY,
        w: innerW,
        h: btnH,
        zIndex: baseZ + 2,
        content: ctaLabel,
        linkAction: 'whatsapp',
        style: {
          fontSize: 12,
          fontWeight: '700',
          color: '#FFFFFF',
          backgroundColor: isPopular ? accentColor : primaryColor,
          borderRadius: ctx.identity.buttonStyle === 'pill' ? 999 : 8,
        },
      });
    });

    return results;
  }

  if (el.type === 'services-grid') {
    const items = ctx.services.filter((srv) => srv.visible).slice(0, 12);
    if (items.length === 0) return [];

    const cols = Math.min(4, Math.max(1, items.length));
    const rows = Math.ceil(items.length / cols);
    const gap = 12;
    const cardW = Math.max(120, Math.floor((el.w - gap * (cols - 1)) / cols));
    const cardH = Math.max(96, Math.floor((el.h - gap * (rows - 1)) / rows));
    const cardBg = s.backgroundColor || ctx.identity.surfaceColor || '#FFFFFF';
    const cardText = s.color || ctx.identity.textColor || '#3B0764';

    items.forEach((srv, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = el.x + col * (cardW + gap);
      const cy = el.y + row * (cardH + gap);
      const pad = 14;
      const innerW = Math.max(80, cardW - pad * 2);
      const prefix = `srv_el_${stamp}_${idx}`;

      results.push({
        id: `${prefix}_bg`,
        type: 'shape',
        name: `Tarjeta · ${srv.title}`,
        x: cx,
        y: cy,
        w: cardW,
        h: cardH,
        zIndex: baseZ,
        style: {
          backgroundColor: cardBg,
          borderColor: s.borderColor || 'rgba(20,20,19,0.1)',
          borderWidth: 1,
          borderRadius: radius,
          shadow: 'sm',
        },
      });

      results.push({
        id: `${prefix}_title`,
        type: 'heading',
        name: `Título · ${srv.title}`,
        x: cx + pad,
        y: cy + 12,
        w: innerW,
        h: 42,
        zIndex: baseZ + 2,
        content: `${srv.number || String(idx + 1).padStart(2, '0')} · ${srv.title}`,
        style: {
          fontSize: 15,
          fontWeight: '700',
          color: cardText,
          lineHeight: 1.2,
        },
      });

      const deliv = srv.deliverables?.length ? `\n\n${srv.deliverables.join(' · ')}` : '';
      results.push({
        id: `${prefix}_desc`,
        type: 'text',
        name: `Detalle · ${srv.title}`,
        x: cx + pad,
        y: cy + 56,
        w: innerW,
        h: Math.max(40, cardH - 68),
        zIndex: baseZ + 2,
        content: `${srv.description}${deliv}`,
        style: {
          fontSize: 11,
          color: cardText,
          lineHeight: 1.4,
        },
      });
    });

    return results;
  }

  if (el.type === 'testimonials-grid') {
    const items = ctx.testimonials.filter((t) => t.visible).slice(0, 4);
    if (items.length === 0) return [];

    const cols = Math.max(1, items.length);
    const gap = 20;
    const cardW = Math.max(160, Math.floor((el.w - gap * (cols - 1)) / cols));
    const cardBg = s.backgroundColor || ctx.identity.surfaceColor || '#FFFFFF';
    const cardText = s.color || ctx.identity.textColor || '#3B0764';

    items.forEach((item, idx) => {
      const cx = el.x + idx * (cardW + gap);
      const cy = el.y;
      const ch = el.h;
      const pad = 20;
      const innerW = Math.max(100, cardW - pad * 2);
      const prefix = `test_el_${stamp}_${idx}`;

      results.push({
        id: `${prefix}_bg`,
        type: 'shape',
        name: `Tarjeta · ${item.clientName}`,
        x: cx,
        y: cy,
        w: cardW,
        h: ch,
        zIndex: baseZ,
        style: {
          backgroundColor: cardBg,
          borderColor: s.borderColor || 'rgba(20,20,19,0.1)',
          borderWidth: 1,
          borderRadius: radius,
          shadow: 'sm',
        },
      });

      if (item.resultMetric) {
        results.push({
          id: `${prefix}_metric`,
          type: 'text',
          name: `Métrica · ${item.clientName}`,
          x: cx + pad,
          y: cy + pad,
          w: innerW,
          h: 22,
          zIndex: baseZ + 2,
          content: item.resultMetric.toUpperCase(),
          style: {
            fontSize: 11,
            fontWeight: '700',
            color: accentColor,
            letterSpacing: '0.08em',
          },
        });
      }

      const quoteY = cy + pad + (item.resultMetric ? 28 : 0);
      const authorH = 48;
      const authorY = cy + ch - pad - authorH;

      results.push({
        id: `${prefix}_quote`,
        type: 'heading',
        name: `Cita · ${item.clientName}`,
        x: cx + pad,
        y: quoteY,
        w: innerW,
        h: Math.max(80, authorY - quoteY - 12),
        zIndex: baseZ + 2,
        content: `“${item.quote}”`,
        style: {
          fontSize: 16,
          fontWeight: '600',
          color: cardText,
          lineHeight: 1.35,
        },
      });

      const subtitle = [item.clientRole, item.company].filter(Boolean).join(' · ');
      results.push({
        id: `${prefix}_author`,
        type: 'text',
        name: `Autor · ${item.clientName}`,
        x: cx + pad,
        y: authorY,
        w: innerW,
        h: authorH,
        zIndex: baseZ + 2,
        content: subtitle ? `${item.clientName}\n${subtitle}` : item.clientName,
        style: {
          fontSize: 12,
          fontWeight: '600',
          color: cardText,
          lineHeight: 1.4,
        },
      });
    });

    return results;
  }

  if (el.type === 'contact-block') {
    const cardBg = s.backgroundColor || ctx.identity.surfaceColor || '#FFFFFF';
    const cardText = s.color || ctx.identity.textColor || '#3B0764';
    const pad = 24;
    const innerW = Math.max(200, el.w - pad * 2);
    const halfW = Math.floor((innerW - 16) / 2);
    const prefix = `contact_el_${stamp}`;

    results.push({
      id: `${prefix}_bg`,
      type: 'shape',
      name: 'Tarjeta Contacto',
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      zIndex: baseZ,
      style: {
        backgroundColor: cardBg,
        borderColor: s.borderColor || 'rgba(20,20,19,0.1)',
        borderWidth: 1,
        borderRadius: radius,
        shadow: 'md',
      },
    });

    results.push({
      id: `${prefix}_wa`,
      type: 'button',
      name: 'Botón WhatsApp',
      x: el.x + pad,
      y: el.y + pad,
      w: halfW,
      h: 48,
      zIndex: baseZ + 2,
      content: ctx.contact.whatsappNumber ? 'Escribir por WhatsApp' : 'Configurar WhatsApp',
      linkAction: 'whatsapp',
      style: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        backgroundColor: primaryColor,
        borderRadius: ctx.identity.buttonStyle === 'pill' ? 999 : 8,
      },
    });

    results.push({
      id: `${prefix}_email`,
      type: 'button',
      name: 'Botón Correo',
      x: el.x + pad + halfW + 16,
      y: el.y + pad,
      w: halfW,
      h: 48,
      zIndex: baseZ + 2,
      content: ctx.contact.email || 'Configurar correo',
      linkAction: 'email',
      style: {
        fontSize: 14,
        fontWeight: '700',
        color: cardText,
        backgroundColor: 'transparent',
        borderColor: 'rgba(20,20,19,0.2)',
        borderWidth: 1,
        borderRadius: ctx.identity.buttonStyle === 'pill' ? 999 : 8,
      },
    });

    const infoY = el.y + Math.max(92, el.h - 76);
    const sub = [ctx.contact.specialty, ctx.contact.location].filter(Boolean).join(' · ');
    results.push({
      id: `${prefix}_info`,
      type: 'text',
      name: 'Nombre y Especialidad',
      x: el.x + pad,
      y: infoY,
      w: Math.floor(innerW * 0.62),
      h: 52,
      zIndex: baseZ + 2,
      content: `${ctx.contact.professionalName || ctx.contact.studioName}\n${sub}`,
      style: {
        fontSize: 13,
        fontWeight: '600',
        color: cardText,
        lineHeight: 1.45,
      },
    });

    const links = [
      ctx.contact.instagramUrl ? 'Instagram' : '',
      ctx.contact.facebookUrl ? 'Facebook' : '',
      ctx.contact.tiktokUrl ? 'TikTok' : '',
      ctx.contact.websiteUrl ? 'Sitio Web' : '',
    ]
      .filter(Boolean)
      .join('  ·  ');

    if (links) {
      results.push({
        id: `${prefix}_links`,
        type: 'text',
        name: 'Redes Sociales',
        x: el.x + pad + Math.floor(innerW * 0.64),
        y: infoY + 8,
        w: Math.floor(innerW * 0.36),
        h: 36,
        zIndex: baseZ + 2,
        content: links,
        style: {
          fontSize: 12,
          fontWeight: '600',
          color: accentColor,
          textAlign: 'right',
        },
      });
    }

    return results;
  }

  return [];
}
