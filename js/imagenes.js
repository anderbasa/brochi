// Redimensiona y comprime una imagen en el propio móvil ANTES de subirla,
// para no llenar el almacenamiento gratuito de Firebase ni gastar datos.
// Devuelve un Blob JPEG.

const MAX_LADO = 1600; // px del lado más largo
const CALIDAD = 0.82;

export async function comprimirImagen(file, { maxLado = MAX_LADO, calidad = CALIDAD } = {}) {
  const bitmap = await cargar(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", calidad));
  return blob || file;
}

export async function comprimirVarias(fileList, opciones) {
  const files = Array.from(fileList || []);
  const out = [];
  for (const f of files) {
    if (f && f.type && f.type.startsWith("image/")) {
      out.push(await comprimirImagen(f, opciones));
    }
  }
  return out;
}

// Vista previa rápida (object URL) — acuérdate de revocarla al quitar el modal.
export function previewURL(blobOFile) {
  return URL.createObjectURL(blobOFile);
}

async function cargar(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch (_) {
      /* algunos navegadores fallan con ciertos JPEG; caemos al <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
