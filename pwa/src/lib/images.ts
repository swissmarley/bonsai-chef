const MAX_EDGE = 1600;
const QUALITY = 0.85;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Older Safari: fall back to an <img> element.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('Impossibile leggere questa immagine. Prova con una foto in formato JPEG o PNG.');
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
}

/** Downscales a photo to at most 1600px and re-encodes it as JPEG (also strips EXIF/GPS metadata). */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const { source, width, height, release } = await decode(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Il browser non riesce a elaborare le immagini.');
    ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Impossibile preparare l'immagine."))), 'image/jpeg', QUALITY),
    );
    return { blob, width: w, height: h };
  } finally {
    release();
  }
}
