import * as pdfjsLib from 'pdfjs-dist';

// Robustly resolve the library object to handle different ESM loader behaviors (CDN vs Bundler)
// jsDelivr's +esm often puts the library under .default
const lib = (pdfjsLib as any).default || pdfjsLib;

// Configure worker
if (lib.GlobalWorkerOptions) {
    lib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
} else {
    console.error("Critical: GlobalWorkerOptions not found in pdfjs-dist import. PDF features will fail.");
}

/**
 * PdfRasterizer
 * Converts PDF pages into high-quality images (ArrayBuffers)
 */
export class PdfRasterizer {
  
  public static async convertToImages(file: File): Promise<ArrayBuffer[]> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF using the resolved library object
    if (!lib.getDocument) {
        throw new Error("PDF.js getDocument method is missing. Check library import.");
    }

    const loadingTask = lib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const images: ArrayBuffer[] = [];
    const scale = 2.0; // Higher scale = better quality but larger file size

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create a canvas to render
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;

      // Export canvas to Blob (JPEG for compression, PNG for quality)
      // JPEG with 0.85 quality is a good trade-off for Word docs
      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );

      if (blob) {
        images.push(await blob.arrayBuffer());
      }
    }

    return images;
  }
}