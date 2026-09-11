// Almacenamiento de fotos: Supabase Storage (capa gratuita sin tarjeta,
// a diferencia de Firebase Storage). Firestore (js/firebase.js) solo guarda
// la URL pública que devuelven las funciones de aquí — si algún día cambia
// el proveedor de fotos, es este el único archivo que hay que tocar.
//
// Bucket esperado: "fotos", público, con políticas que permiten
// SELECT/INSERT/UPDATE/DELETE a todo el mundo (mismo modelo de confianza de
// 2 personas que las reglas de Firestore). Ver README.md, sección 1.3.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseConfig } from "./config.js";

const BUCKET = "fotos";
const MAX_BYTES = 5 * 1024 * 1024; // coincide con el límite de tamaño del bucket

// Se crea al primer uso, no al cargar el módulo: mientras `config.js` tenga
// los placeholders "PEGA_AQUI_...", `createClient` lanzaría un error de URL
// inválida y rompería toda la app (fotos.js lo importa firebase.js). Con esto
// solo falla si de verdad se intenta subir/borrar una foto sin configurar.
let supabase;
function cliente() {
  if (!supabase) supabase = createClient(urlBase(supabaseConfig.url), supabaseConfig.anonKey);
  return supabase;
}

// El panel "Data API" de Supabase a veces muestra la URL del endpoint REST
// (con "/rest/v1/" al final) en vez de la URL base del proyecto que pide
// `createClient`. Aceptamos las dos formas para no depender de cuál se copió.
function urlBase(url) {
  return String(url).replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export async function subirImagen(blob, path) {
  if (blob.size > MAX_BYTES) {
    throw new Error("La foto sigue pesando demasiado incluso comprimida (máx. 5 MB).");
  }
  const { error } = await cliente().storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  const { data } = cliente().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function borrarImagen(url) {
  const path = pathDesdeUrl(url);
  if (!path) return;
  try {
    await cliente().storage.from(BUCKET).remove([path]);
  } catch (_) {
    // si la foto ya no existe, no pasa nada
  }
}

// Borra todos los archivos directamente dentro de un "prefijo" (carpeta),
// p. ej. "recuerdos/abc123".
export async function borrarCarpeta(prefijo) {
  try {
    const { data, error } = await cliente().storage.from(BUCKET).list(prefijo);
    if (error || !data || !data.length) return;
    await cliente().storage.from(BUCKET).remove(data.map((f) => `${prefijo}/${f.name}`));
  } catch (_) {}
}

function pathDesdeUrl(url) {
  const marca = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length));
}
