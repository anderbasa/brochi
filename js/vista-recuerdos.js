// Recuerdos: cuadrícula de tarjetas + detalle con galería, nota y ubicación.
// Se pueden añadir/quitar fotos, editar la nota y borrar el recuerdo entero.

import { PERSONAS } from "./config.js";
import {
  editarRecuerdo,
  borrarFotoDeRecuerdo,
  borrarRecuerdo,
} from "./firebase.js";
import { store, observarSalida } from "./app.js";
import { comprimirVarias } from "./imagenes.js";
import {
  el,
  limpiar,
  abrirModal,
  cerrarModal,
  aviso,
  confirmar,
  fechaTS,
  fechaLegible,
  campoFotos,
} from "./ui.js";

export function renderRecuerdos(cont) {
  const pintar = () => {
    limpiar(cont);
    if (store.cargando) {
      cont.append(el("p", { class: "cargando", text: "Cargando…" }));
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
    cont.append(
      el("div", { class: "grid-recuerdos" },
        ...store.recuerdos.map((r) =>
          el("button", { class: "cr", onclick: () => detalle(r.id) },
            r.fotos && r.fotos[0]
              ? el("img", { src: r.fotos[0], alt: "", loading: "lazy" })
              : el("div", { class: "sin-foto", text: "📸" }),
            el("div", { class: "cr-txt" },
              el("strong", { text: r.titulo }),
              el("span", { text: fechaLegible(fechaTS(r.creadoEn)) }),
              r.ubicacion?.texto && el("span", { class: "cr-lugar", text: "📍 " + r.ubicacion.texto })
            )
          )
        )
      )
    );
  };
  pintar();
  const off = store.onChange(pintar);
  observarSalida(cont, off);
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
    el("p", { class: "detalle-fecha", text: `${fechaLegible(fechaTS(r.creadoEn))} · lo guardó ${nombre(r.creadoPor)}` }),
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
    } catch (err) {
      console.error(err);
      aviso("No se pudo guardar", "error");
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
