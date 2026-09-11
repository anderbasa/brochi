// Capa de datos compartidos. Firestore guarda planes y recuerdos; las FOTOS
// viven en Supabase Storage (js/fotos.js) porque su capa gratuita no exige
// tarjeta — este archivo solo guarda las URLs que ese módulo le devuelve.
// Si algún día cambiáis de backend de datos, es aquí donde hay que tocar.
//
// Modelo de datos (colecciones de Firestore):
//
//   planes/{id}
//     titulo        string   (obligatorio)
//     nota          string   ("" si vacío)
//     categoria     string|null   ver CATEGORIAS en config.js
//     fechaObjetivo string|null   "YYYY-MM-DD"
//     fotoRef       string|null   URL pública en Supabase Storage
//     estado        "pendiente" | "hecho"
//     creadoPor     "ander" | "pareja"
//     completadoPor "ander" | "pareja" | null
//     recuerdoId    string|null   recuerdo asociado al completarlo
//     creadoEn      Timestamp (servidor)
//     completadoEn  Timestamp|null
//
//   recuerdos/{id}
//     planId     string|null   plan de origen
//     titulo     string
//     nota       string
//     fotos      string[]      URLs públicas en Supabase Storage
//     ubicacion  { texto: string, lat: number|null, lng: number|null } | null
//     creadoPor  "ander" | "pareja"
//     creadoEn   Timestamp (servidor)
//     reacciones { [personaId]: true }   quién le ha dado ❤️ (opcional)
//
// Fotos (bucket "fotos" de Supabase):
//   planes/{planId}/ref_{ts}.jpg
//   recuerdos/{recuerdoId}/{ts}_{i}.jpg

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, supabaseConfig } from "./config.js";
import { subirImagen, borrarImagen, borrarCarpeta } from "./fotos.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function sinPlaceholders(obj) {
  return !Object.values(obj).some((v) => String(v).startsWith("PEGA_AQUI"));
}

export function firebaseListo() {
  return sinPlaceholders(firebaseConfig);
}
export function supabaseListo() {
  return sinPlaceholders(supabaseConfig);
}
export function isConfigured() {
  return firebaseListo() && supabaseListo();
}

// ---- Lectura en vivo -------------------------------------------------------

// Ordenamos en el cliente (por `creadoEn`, más nuevo primero) en vez de con
// orderBy: así un documento recién creado, cuyo serverTimestamp aún no ha
// resuelto, también aparece de inmediato en la lista.
function ordenados(snap) {
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => ms(b.creadoEn) - ms(a.creadoEn));
}
function ms(ts) {
  if (!ts) return Date.now(); // pendiente de servidor → tratar como "ahora mismo"
  return ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
}

export function subscribePlanes(callback) {
  return onSnapshot(collection(db, "planes"), (snap) => callback(ordenados(snap)));
}

export function subscribeRecuerdos(callback) {
  return onSnapshot(collection(db, "recuerdos"), (snap) => callback(ordenados(snap)));
}

// ---- Planes ---------------------------------------------------------------

export async function crearPlan(datos, personaId) {
  const ref = await addDoc(collection(db, "planes"), {
    titulo: datos.titulo.trim(),
    nota: (datos.nota || "").trim(),
    categoria: datos.categoria || null,
    fechaObjetivo: datos.fechaObjetivo || null,
    fotoRef: null,
    estado: "pendiente",
    creadoPor: personaId,
    completadoPor: null,
    recuerdoId: null,
    creadoEn: serverTimestamp(),
    completadoEn: null,
  });
  if (datos.fotoBlob) {
    const url = await subirImagen(datos.fotoBlob, `planes/${ref.id}/ref_${Date.now()}.jpg`);
    await updateDoc(ref, { fotoRef: url });
  }
  return ref.id;
}

export async function editarPlan(id, datos) {
  const cambios = {
    titulo: datos.titulo.trim(),
    nota: (datos.nota || "").trim(),
    categoria: datos.categoria || null,
    fechaObjetivo: datos.fechaObjetivo || null,
  };
  if (datos.fotoBlob) {
    cambios.fotoRef = await subirImagen(datos.fotoBlob, `planes/${id}/ref_${Date.now()}.jpg`);
  } else if (datos.quitarFoto) {
    cambios.fotoRef = null;
  }
  await updateDoc(doc(db, "planes", id), cambios);
}

export async function marcarPendiente(id) {
  await updateDoc(doc(db, "planes", id), {
    estado: "pendiente",
    completadoPor: null,
    completadoEn: null,
  });
}

export async function borrarPlan(id) {
  await borrarCarpeta(`planes/${id}`);
  await deleteDoc(doc(db, "planes", id));
}

// ---- Completar un plan → crear su recuerdo -------------------------------

// Sube las fotos, crea el doc del recuerdo y marca el plan como hecho.
export async function completarPlan(plan, recuerdo, personaId) {
  const ref = await addDoc(collection(db, "recuerdos"), {
    planId: plan.id,
    titulo: recuerdo.titulo?.trim() || plan.titulo,
    nota: (recuerdo.nota || "").trim(),
    fotos: [],
    ubicacion: recuerdo.ubicacion || null,
    creadoPor: personaId,
    creadoEn: serverTimestamp(),
  });

  const urls = [];
  for (let i = 0; i < (recuerdo.fotosBlobs || []).length; i++) {
    urls.push(await subirImagen(recuerdo.fotosBlobs[i], `recuerdos/${ref.id}/${Date.now()}_${i}.jpg`));
  }
  if (urls.length) await updateDoc(ref, { fotos: urls });

  await updateDoc(doc(db, "planes", plan.id), {
    estado: "hecho",
    completadoPor: personaId,
    completadoEn: serverTimestamp(),
    recuerdoId: ref.id,
  });
  return ref.id;
}

// ---- Recuerdos ----------------------------------------------------------

// Añadir fotos/nota a un recuerdo ya existente.
export async function editarRecuerdo(id, datos, fotosActuales) {
  const cambios = {};
  if (datos.titulo !== undefined) cambios.titulo = datos.titulo.trim();
  if (datos.nota !== undefined) cambios.nota = datos.nota.trim();
  if (datos.ubicacion !== undefined) cambios.ubicacion = datos.ubicacion;

  const nuevas = [];
  for (let i = 0; i < (datos.fotosBlobs || []).length; i++) {
    nuevas.push(await subirImagen(datos.fotosBlobs[i], `recuerdos/${id}/${Date.now()}_${i}.jpg`));
  }
  if (nuevas.length) cambios.fotos = [...(fotosActuales || []), ...nuevas];

  await updateDoc(doc(db, "recuerdos", id), cambios);
}

export async function borrarFotoDeRecuerdo(id, url, fotosActuales) {
  await borrarImagen(url);
  await updateDoc(doc(db, "recuerdos", id), {
    fotos: (fotosActuales || []).filter((u) => u !== url),
  });
}

// Alterna el ❤️ de `personaId` en un recuerdo (like/quitar like).
export async function alternarReaccion(id, personaId, yaLeGusta) {
  await updateDoc(doc(db, "recuerdos", id), {
    [`reacciones.${personaId}`]: yaLeGusta ? false : true,
  });
}

export async function borrarRecuerdo(recuerdo) {
  await borrarCarpeta(`recuerdos/${recuerdo.id}`);
  if (recuerdo.planId) {
    // deja el plan marcado como hecho pero sin recuerdo enlazado
    try {
      await updateDoc(doc(db, "planes", recuerdo.planId), { recuerdoId: null });
    } catch (_) {}
  }
  await deleteDoc(doc(db, "recuerdos", recuerdo.id));
}
