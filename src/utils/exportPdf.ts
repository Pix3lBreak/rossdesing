import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function downloadSlideAsPng(element: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await toPng(element, {
    width: 1280,
    height: 720,
    pixelRatio: 2,
    cacheBust: true,
  });
  const link = document.createElement('a');
  link.download = `${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  link.href = dataUrl;
  link.click();
}

export async function exportSlidesToPdf(
  getSlideElements: () => HTMLElement[],
  fileName = 'portafolio-studio-pro',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const nodes = getSlideElements();
  if (nodes.length === 0) {
    throw new Error('No hay páginas visibles para exportar.');
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1280, 720],
    hotfixes: ['px_scaling'],
  });

  for (let i = 0; i < nodes.length; i++) {
    onProgress?.(i + 1, nodes.length);
    const dataUrl = await toPng(nodes[i], {
      width: 1280,
      height: 720,
      pixelRatio: 2,
      cacheBust: true,
    });
    if (i > 0) {
      pdf.addPage([1280, 720], 'landscape');
    }
    pdf.addImage(dataUrl, 'PNG', 0, 0, 1280, 720, undefined, 'FAST');
  }

  pdf.save(`${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}
