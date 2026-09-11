// Recuerdos: cuadrícula de tarjetas + detalle con galería, nota y ubicación.
// Se pueden añadir/quitar fotos, editar la nota y borrar el recuerdo entero.

import { PERSONAS } from "./config.js";
import {
  editarRecuerdo,
  borrarFotoDeRecuerdo,
  borrarRecuerdo,
  alternarReaccion,
} from "./firebase.js";
import { store, observarSalida } from "./app.js";
import { comprimirVarias } from "./imagenes.js";
import {
  el,
  limpiar,
  abrirModal,
  cerrarModal,
  aviso,
  mensajeError,
  confirmar,
  fechaTS,
  fechaLegible,
  fechaRelativa,
  campoFotos,
  vibrar,
  skeleton,
} from "./ui.js";

let busqueda = "";

export function renderRecuerdos(cont) {
  const pintar = () => {
    // Igual que en Lista: conserva el foco del buscador al reconstruir el DOM.
    const activo = document.activeElement;
    const eraBuscador = activo?.classList.contains("buscador");
    const cursor = eraBuscador ? activo.selectionStart : null;

    limpiar(cont);
    if (store.cargando) {
      cont.append(skeleton(4));
      return;
    }
    if (!store.recuerdos.length) {
      cont.append(
        el("div", { class: "vacio" },
          el("p", { text: "Aún no hay recuerdos." }),
          el("p", { class: "sub", text: "Completa un plan de la lista para guardar el primero." }),
          el("a", { href: "#lista", class: "btn-primario", text: "Ir a la lista" })
        )
      );
      return;
    }

    if (store.recuerdos.length > 3) {
      cont.append(campoBusqueda(pintar));
    }

    const filtrados = store.recuerdos.filter((r) => coincideBusqueda(r, busqueda));
    if (!filtrados.length) {
      cont.append(el("div", { class: "vacio" }, el("p", { text: "Nada coincide con la búsqueda." })));
    } else {
      cont.append(
        el("div", { class: "grid-recuerdos" },
          ...filtrados.map((r) =>
            el("button", { class: "cr", onclick: () => detalle(r.id) },
              r.fotos && r.fotos[0]
                ? el("img", { src: r.fotos[0], alt: "", loading: "lazy" })
                : el("div", { class: "sin-foto", text: "📸" }),
              corazonMini(r),
              el("div", { class: "cr-txt" },
                el("strong", { text: r.titulo }),
                el("span", { text: fechaRelativa(r.creadoEn) }),
                r.ubicacion?.texto && el("span", { class: "cr-lugar", text: "📍 " + r.ubicacion.texto })
              )
            )
          )
        )
      );
    }

    if (eraBuscador) {
      const nuevo = cont.querySelector(".buscador");
      if (nuevo) {
        nuevo.focus();
        if (cursor != null) nuevo.setSelectionRange(cursor, cursor);
      }
    }
  };
  pintar();
  const off = store.onChange(pintar);
  observarSalida(cont, off);
}

function coincideBusqueda(r, texto) {
  const q = texto.trim().toLowerCase();
  if (!q) return true;
  return (
    r.titulo.toLowerCase().includes(q) ||
    (r.nota || "").toLowerCase().includes(q) ||
    (r.ubicacion?.texto || "").toLowerCase().includes(q)
  );
}

function campoBusqueda(pintar) {
  const input = el("input", {
    type: "search",
    class: "buscador",
    placeholder: "Buscar por título, nota o lugar…",
    value: busqueda,
  });
  input.addEventListener("input", () => { busqueda = input.value; pintar(); });
  return el("div", { class: "barra-filtro" }, input);
}

// ---- Reacción ❤️ ----------------------------------------------------

async function alCorazon(r) {
  vibrar(15);
  const yo = store.persona.id;
  await alternarReaccion(r.id, yo, !!(r.reacciones && r.reacciones[yo]));
}

// Corazón pequeño sobre la miniatura — es un <span>, no un <button>: la
// tarjeta entera YA es un <button> (abre el detalle) y anidar botones no es
// válido en HTML.
function corazonMini(r) {
  const yo = store.persona?.id;
  const leGusta = !!(r.reacciones && r.reacciones[yo]);
  const total = Object.values(r.reacciones || {}).filter(Boolean).length;
  return el(
    "span",
    {
      class: "corazon-mini" + (leGusta ? " activo" : ""),
      onclick: (e) => { e.stopPropagation(); alCorazon(r); },
    },
    leGusta ? "❤️" : "🤍",
    total > 0 ? ` ${total}` : ""
  );
}

function corazonDetalle(r) {
  const yo = store.persona.id;
  const otroId = Object.keys(PERSONAS).find((id) => id !== yo);
  const leGusta = !!(r.reacciones && r.reacciones[yo]);
  const leGustaOtro = !!(r.reacciones && r.reacciones[otroId]);

  let etiqueta;
  if (leGusta && leGustaOtro) etiqueta = "❤️ Os gusta a los dos";
  else if (leGusta) etiqueta = "❤️ Te gusta esto";
  else if (leGustaOtro) etiqueta = `❤️ A ${nombre(otroId)} le gusta esto`;
  else etiqueta = "🤍 Dar un like";

  return el(
    "button",
    {
      type: "button",
      class: "btn-corazon-detalle" + (leGusta ? " activo" : ""),
      onclick: async () => {
        await alCorazon(r);
        cerrarModal();
        detalle(r.id);
      },
    },
    etiqueta
  );
}

// ---- Detalle ------------------------------------------------------

function detalle(id) {
  const r = store.recuerdos.find((x) => x.id === id);
  if (!r) return;

  const galeria = el("div", { class: "galeria-detalle" },
    ...(r.fotos || []).map((url) =>
      el("div", { class: "foto-detalle" },
        el("img", { src: url, alt: "", onclick: () => verGrande(url) }),
        el("button", { class: "quita-foto", title: "Quitar foto", onclick: async () => {
          if (await confirmar("¿Quitar esta foto del recuerdo?")) {
            await borrarFotoDeRecuerdo(r.id, url, r.fotos);
            cerrarModal();
            detalle(r.id);
          }
        } }, "×")
      )
    )
  );

  const cont = el("div", { class: "detalle" },
    el("div", { class: "detalle-cab" },
      el("h3", { text: r.titulo }),
      el("button", { class: "icono-btn", title: "Cerrar", onclick: cerrarModal }, "×")
    ),
    el("p", { class: "detalle-fecha", text: `${fechaLegible(fechaTS(r.creadoEn))} · ${quienGuardo(r.creadoPor)}` }),
    corazonDetalle(r),
    (r.fotos && r.fotos.length) ? galeria : el("p", { class: "sub", text: "Sin fotos todavía." }),
    r.nota && el("p", { class: "detalle-nota", text: r.nota }),
    r.ubicacion?.texto && el("p", { class: "detalle-lugar", text: "📍 " + r.ubicacion.texto }),
    (r.ubicacion?.lat != null) && el("a", {
      class: "enlace-mapa",
      href: `https://www.openstreetmap.org/?mlat=${r.ubicacion.lat}&mlon=${r.ubicacion.lng}#map=16/${r.ubicacion.lat}/${r.ubicacion.lng}`,
      target: "_blank",
      rel: "noopener",
      text: "Ver en el mapa",
    }),
    el("div", { class: "detalle-acciones" },
      el("button", { class: "btn-foto", onclick: () => formEditar(r) }, "✏️ Editar / añadir fotos"),
      el("button", { class: "btn-peligro", onclick: async () => {
        if (await confirmar(`¿Borrar el recuerdo "${r.titulo}"? Se borran también sus fotos.`)) {
          await borrarRecuerdo(r);
          cerrarModal();
          aviso("Recuerdo borrado");
        }
      } }, "Borrar recuerdo")
    )
  );

  abrirModal(cont);
}

function verGrande(url) {
  const v = el("div", { class: "visor", onclick: () => v.remove() },
    el("img", { src: url, alt: "" })
  );
  document.body.append(v);
}

// ---- Editar ------------------------------------------------------

function formEditar(r) {
  const titulo = el("input", { type: "text", maxlength: 120, value: r.titulo });
  const nota = el("textarea", { rows: 4, maxlength: 1000, placeholder: "Nota del recuerdo" }, r.nota || "");
  const lugar = el("input", { type: "text", maxlength: 160, value: r.ubicacion?.texto || "", placeholder: "Lugar (texto libre)" });
  const fotos = campoFotos({ multiple: true, etiqueta: "Añadir más fotos" });
  const guardar = el("button", { type: "submit", class: "btn-primario" }, "Guardar");

  const form = el("form", { class: "form" },
    el("h3", { text: "Editar recuerdo" }),
    campoL("Título", titulo),
    campoL("Nota", nota),
    campoL("Lugar", lugar),
    campoL("Fotos nuevas", fotos.nodo),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-plano", onclick: () => { cerrarModal(); detalle(r.id); } }, "Cancelar"),
      guardar
    )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    guardar.disabled = true;
    guardar.textContent = "Guardando…";
    try {
      const fotosBlobs = await comprimirVarias(fotos.archivos());
      const ubic = r.ubicacion || {};
      const ubicacion = lugar.value.trim() || ubic.lat != null
        ? { texto: lugar.value.trim(), lat: ubic.lat ?? null, lng: ubic.lng ?? null }
        : null;
      await editarRecuerdo(r.id, { titulo: titulo.value, nota: nota.value, ubicacion, fotosBlobs }, r.fotos);
      cerrarModal();
      aviso("Recuerdo actualizado");
      vibrar(25);
    } catch (err) {
      console.error(err);
      aviso(mensajeError(err), "error");
      guardar.disabled = false;
      guardar.textContent = "Guardar";
    }
  });

  abrirModal(form);
}

function campoL(etiqueta, control) {
  return el("label", { class: "campo" }, el("span", { class: "campo-et", text: etiqueta }), control);
}

function nombre(personaId) {
  if (store.persona?.id === personaId) return "tú";
  return PERSONAS[personaId]?.nombre || "alguien";
}

// "lo guardaste tú" / "lo guardó Naia" — nombre() ya resuelve "tú", pero
// aquí el verbo cambia de persona según quién sea, no solo el nombre.
function quienGuardo(personaId) {
  return store.persona?.id === personaId ? "lo guardaste tú" : `lo guardó ${nombre(personaId)}`;
}
