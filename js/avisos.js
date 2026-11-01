// Avisos en directo: si con la app abierta la otra persona añade un plan,
// guarda un recuerdo o le da ❤️ a uno, baja una notificacion desde arriba.
// Solo por lo que hace la OTRA persona: lo tuyo no te lo avisa.
//
// Los cambios llegan de firebase.js (subscribe*: segundo argumento), ya sin
// la primera carga y sin lo que acaba de escribir este movil.

import { otra } from "./identidad.js";
import { notificacion } from "./ui.js";

// estado anterior de las reacciones, para saber si un ❤️ es nuevo
const reaccionesPrevias = new Map();

export function recordarReacciones(recuerdos) {
  reaccionesPrevias.clear();
  for (const r of recuerdos) reaccionesPrevias.set(r.id, { ...(r.reacciones || {}) });
}

// coleccion: "planes" | "recuerdos"; acciones: { irALista, abrirRecuerdo }
export function avisarCambios(coleccion, cambios, personaId, acciones) {
  const otro = otra(personaId);
  if (!otro || !cambios.length) return;

  for (const { tipo, id, datos: d } of cambios) {
    if (coleccion === "planes" && tipo === "added" && d.creadoPor === otro.id) {
      notificacion({
        titulo: `${otro.nombre} ha añadido un plan`,
        texto: d.titulo,
        alTocar: acciones.irALista,
      });
    }

    if (coleccion === "recuerdos" && tipo === "added" && d.creadoPor === otro.id) {
      // completar un plan crea su recuerdo: este aviso cubre los dos
      notificacion({
        titulo: `${otro.nombre} ha guardado un recuerdo 📸`,
        texto: d.titulo,
        alTocar: () => acciones.abrirRecuerdo(id),
      });
    }

    if (coleccion === "recuerdos" && tipo === "modified") {
      const antes = reaccionesPrevias.get(id) || {};
      if (!antes[otro.id] && d.reacciones && d.reacciones[otro.id]) {
        notificacion({
          titulo: `A ${otro.nombre} le ha gustado un recuerdo`,
          texto: `❤️ ${d.titulo}`,
          alTocar: () => acciones.abrirRecuerdo(id),
        });
      }
    }
  }
}
