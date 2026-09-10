// "¿Quién eres?" — se resuelve una vez por dispositivo y se guarda en
// localStorage. Prioridad: parámetro ?yo= de la URL (pegatina NFC) > lo
// guardado antes > pantalla de selección manual.

import { PERSONAS } from "./config.js";

const CLAVE = "brochi.yo";

export function personaGuardada() {
  const id = localStorage.getItem(CLAVE);
  return id && PERSONAS[id] ? PERSONAS[id] : null;
}

export function guardarPersona(id) {
  if (PERSONAS[id]) localStorage.setItem(CLAVE, id);
}

export function otra(id) {
  const ids = Object.keys(PERSONAS);
  return PERSONAS[ids.find((x) => x !== id)] || null;
}

// Lee ?yo= y lo persiste; limpia el parámetro de la barra de direcciones.
export function resolverDesdeURL() {
  const params = new URLSearchParams(location.search);
  const yo = params.get("yo");
  if (yo && PERSONAS[yo]) {
    guardarPersona(yo);
    params.delete("yo");
    const limpio = location.pathname + (params.toString() ? "?" + params : "") + location.hash;
    history.replaceState(null, "", limpio);
    return PERSONAS[yo];
  }
  return personaGuardada();
}
