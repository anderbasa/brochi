// Lista de deseos compartida: pendientes / hechos, con crear, editar,
// completar (→ recuerdo) y borrar.

import { CATEGORIAS } from "./config.js";
import {
  crearPlan,
  editarPlan,
  borrarPlan,
  marcarPendiente,
  completarPlan,
} from "./firebase.js";
import { store, observarSalida } from "./app.js";
import { comprimirImagen, comprimirVarias } from "./imagenes.js";
import { campoUbicacion } from "./selector-mapa.js";
import {
  el,
  limpiar,
  abrirModal,
  cerrarModal,
  aviso,
  mensajeError,
  confirmar,
  cuentaAtras,
  campoFotos,
  vibrar,
  skeleton,
  menuContextual,
} from "./ui.js";
import { verRecuerdo } from "./vista-recuerdos.js";

let filtro = "pendiente"; // "pendiente" | "hecho"
let busqueda = "";
let categoriaFiltro = null;

export function renderLista(cont) {
  let conocidos = null; // ids ya pintados: solo se animan los que llegan nuevos
  const pintar = () => {
    // Conserva el foco/cursor del buscador: al escribir, `input` dispara
    // pintar() y esto reconstruye TODO el DOM (incluido un <input> nuevo);
    // sin esto, cada letra tecleada perdería el foco.
    const activo = document.activeElement;
    const eraBuscador = activo?.classList.contains("buscador");
    const cursor = eraBuscador ? activo.selectionStart : null;

    limpiar(cont);
    const planes = store.planes
      .filter((p) => p.estado === filtro)
      .filter((p) => !categoriaFiltro || p.categoria === categoriaFiltro)
      .filter((p) => coincideBusqueda(p, busqueda));

    cont.append(
      el("div", { class: "segmentado" },
        boton("pendiente", "Pendientes", store.planes.filter((p) => p.estado === "pendiente").length, pintar),
        boton("hecho", "Hechos", store.planes.filter((p) => p.estado === "hecho").length, pintar)
      )
    );

    if (store.cargando) {
      cont.append(skeleton(3));
      return;
    }

    if (store.planes.length > 3) {
      cont.append(campoBusquedaYFiltro(pintar));
    }

    if (!planes.length) {
      const nada = busqueda.trim() || categoriaFiltro;
      cont.append(
        el("div", { class: "vacio" },
          el("p", { text: nada
            ? "Nada coincide con la búsqueda."
            : filtro === "pendiente" ? "No hay planes pendientes." : "Todavía no habéis completado ninguno." }),
          !nada && filtro === "pendiente" && el("button", { class: "btn-primario", onclick: () => formPlan() }, "Añadir un plan")
        )
      );
    } else {
      cont.append(el("ul", { class: "lista-planes" },
        ...planes.map((p, i) => tarjetaPlan(p, i, conocidos && !conocidos.has(p.id)))
      ));
    }

    cont.append(
      el("button", { class: "fab", "aria-label": "Añadir plan", onclick: () => formPlan() }, "+")
    );

    if (eraBuscador) {
      const nuevo = cont.querySelector(".buscador");
      if (nuevo) {
        nuevo.focus();
        if (cursor != null) nuevo.setSelectionRange(cursor, cursor);
      }
    }
    // al cambiar de filtro no hay "nuevos": se conocen todos los planes
    if (!store.cargando) conocidos = new Set(store.planes.map((p) => p.id));
  };

  pintar();
  const off = store.onChange(pintar);
  observarSalida(cont, off);
}

function coincideBusqueda(plan, texto) {
  const q = texto.trim().toLowerCase();
  if (!q) return true;
  return plan.titulo.toLowerCase().includes(q) || (plan.nota || "").toLowerCase().includes(q);
}

function campoBusquedaYFiltro(pintar) {
  const input = el("input", {
    type: "search",
    class: "buscador",
    placeholder: "Buscar por título o nota…",
    value: busqueda,
  });
  input.addEventListener("input", () => { busqueda = input.value; pintar(); });

  const chips = el("div", { class: "chips-cat chips-filtro" },
    ...CATEGORIAS.map((c) =>
      el("button", {
        type: "button",
        class: "chip-cat" + (categoriaFiltro === c.id ? " activo" : ""),
        onclick: () => { categoriaFiltro = categoriaFiltro === c.id ? null : c.id; pintar(); },
      }, `${c.emoji} ${c.etiqueta}`)
    )
  );

  return el("div", { class: "barra-filtro" }, input, chips);
}

function boton(valor, texto, n, pintar) {
  return el("button", {
    class: "seg" + (filtro === valor ? " activo" : ""),
    onclick: () => { filtro = valor; pintar(); },
  }, `${texto} (${n})`);
}

function tarjetaPlan(plan, i = 0, nuevo = false) {
  const cat = CATEGORIAS.find((c) => c.id === plan.categoria);
  const ca = plan.estado === "pendiente" ? cuentaAtras(plan.fechaObjetivo) : null;

  const cuerpo = el("div", { class: "plan-cuerpo" },
    el("div", { class: "plan-tit-fila" },
      cat && el("span", { class: "plan-emoji", title: cat.etiqueta, text: cat.emoji }),
      el("span", { class: "plan-tit", text: plan.titulo })
    ),
    plan.nota && el("p", { class: "plan-nota", text: plan.nota }),
    el("div", { class: "plan-meta" },
      ca && el("span", { class: `badge ${ca.clase}`, text: ca.texto }),
      plan.estado === "hecho" && plan.completadoPor &&
        el("span", { class: "badge hecho", text: "✓ hecho" })
    )
  );

  const acciones = el("div", { class: "plan-acciones" });
  if (plan.estado === "pendiente") {
    acciones.append(
      el("button", { class: "btn-completar", onclick: () => { vibrar(); formRecuerdo(plan); } }, "Completar"),
      el("button", { class: "icono-btn", title: "Editar", onclick: () => formPlan(plan) }, "✏️"),
      el("button", { class: "icono-btn", title: "Borrar", onclick: () => pedirBorrado(plan) }, "🗑️")
    );
  } else {
    if (plan.recuerdoId) {
      acciones.append(el("button", { type: "button", class: "btn-plano", onclick: () => verRecuerdo(plan.recuerdoId) }, "Ver recuerdo"));
    }
    acciones.append(
      el("button", { class: "icono-btn", title: "Marcar pendiente", onclick: async () => {
        await marcarPendiente(plan.id);
        aviso("Vuelve a pendientes");
      } }, "↩️"),
      el("button", { class: "icono-btn", title: "Borrar", onclick: () => pedirBorrado(plan) }, "🗑️")
    );
  }

  const tarjeta = el("li", { class: "plan" + (plan.fotoRef ? " con-foto" : "") + (nuevo ? " nuevo" : ""), style: `--i:${i}` },
    plan.fotoRef && el("div", { class: "plan-foto" }, el("img", { src: plan.fotoRef, alt: "", loading: "lazy" })),
    cuerpo,
    acciones
  );
  menuContextual(tarjeta, () => plan.estado === "pendiente"
    ? [
        { texto: "Completar", icono: "✅", accion: () => formRecuerdo(plan) },
        { texto: "Editar", icono: "✏️", accion: () => formPlan(plan) },
        { texto: "Borrar", icono: "🗑️", peligro: true, accion: () => pedirBorrado(plan) },
      ]
    : [
        plan.recuerdoId && { texto: "Ver recuerdo", icono: "📸", accion: () => verRecuerdo(plan.recuerdoId) },
        { texto: "Volver a pendientes", icono: "↩️", accion: async () => { await marcarPendiente(plan.id); aviso("Vuelve a pendientes"); } },
        { texto: "Borrar", icono: "🗑️", peligro: true, accion: () => pedirBorrado(plan) },
      ]);
  return tarjeta;
}

async function pedirBorrado(plan) {
  if (await confirmar(`¿Borrar "${plan.titulo}"?`)) {
    await borrarPlan(plan.id);
    aviso("Plan borrado");
  }
}

// ---- Formulario de plan (crear / editar) ---------------------------

function formPlan(plan = null) {
  const editando = !!plan;
  const titulo = el("input", { type: "text", required: true, maxlength: 120, placeholder: "¿Qué queréis hacer?", value: plan?.titulo || "" });
  const nota = el("textarea", { rows: 3, maxlength: 600, placeholder: "Una nota, un porqué, un detalle…" }, plan?.nota || "");
  const fecha = el("input", { type: "date", value: plan?.fechaObjetivo || "" });

  const cats = el("div", { class: "chips-cat" },
    ...CATEGORIAS.map((c) => {
      const b = el("button", {
        type: "button",
        class: "chip-cat" + (plan?.categoria === c.id ? " activo" : ""),
        "data-cat": c.id,
        onclick: () => {
          const yaActivo = b.classList.contains("activo");
          cats.querySelectorAll(".chip-cat").forEach((x) => x.classList.remove("activo"));
          if (!yaActivo) b.classList.add("activo");
        },
      }, `${c.emoji} ${c.etiqueta}`);
      return b;
    })
  );

  const fotos = campoFotos({ multiple: false, etiqueta: plan?.fotoRef ? "Cambiar foto" : "Foto de referencia" });
  let quitarFoto = false;
  const fotoActual = plan?.fotoRef
    ? el("div", { class: "foto-actual" },
        el("img", { src: plan.fotoRef, alt: "" }),
        el("button", { type: "button", class: "quita-foto", onclick: (e) => {
          quitarFoto = true;
          e.target.closest(".foto-actual").remove();
        } }, "×"))
    : null;

  const guardar = el("button", { type: "submit", class: "btn-primario" }, editando ? "Guardar" : "Añadir plan");

  const form = el("form", { class: "form" },
    el("h3", { text: editando ? "Editar plan" : "Nuevo plan" }),
    campo("Título", titulo),
    campo("Nota", nota),
    campo("Categoría", cats),
    campo("Fecha objetivo (opcional)", fecha),
    campo("Imagen (opcional)", el("div", {}, fotoActual, fotos.nodo)),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-plano", onclick: cerrarModal }, "Cancelar"),
      guardar
    )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!titulo.value.trim()) return;
    vibrar();
    guardar.disabled = true;
    guardar.textContent = "Guardando…";
    try {
      const catSel = cats.querySelector(".chip-cat.activo")?.dataset.cat || null;
      const [f] = fotos.archivos();
      const fotoBlob = f ? await comprimirImagen(f) : null;
      const datos = { titulo: titulo.value, nota: nota.value, categoria: catSel, fechaObjetivo: fecha.value || null, fotoBlob, quitarFoto };
      if (editando) await editarPlan(plan.id, datos);
      else await crearPlan(datos, store.persona.id);
      cerrarModal();
      aviso(editando ? "Plan actualizado" : "Plan añadido");
    } catch (err) {
      console.error(err);
      aviso(mensajeError(err), "error");
      guardar.disabled = false;
      guardar.textContent = editando ? "Guardar" : "Añadir plan";
    }
  });

  abrirModal(form);
  setTimeout(() => titulo.focus(), 50);
}

// ---- Formulario de recuerdo al completar --------------------------

function formRecuerdo(plan) {
  const nota = el("textarea", { rows: 4, maxlength: 1000, placeholder: "¿Cómo fue? ¿Qué recordáis de ese día?" });
  const lugar = el("input", { type: "text", maxlength: 160, placeholder: "Ej. Playa de la Concha, San Sebastián" });
  const fotos = campoFotos({ multiple: true, etiqueta: "Fotos del recuerdo" });

  const sitio = campoUbicacion({ lugar });

  const guardar = el("button", { type: "submit", class: "btn-primario" }, "Guardar recuerdo");

  const form = el("form", { class: "form" },
    el("h3", { text: "¡Completado! 🎉" }),
    el("p", { class: "form-sub", text: `"${plan.titulo}" pasa a Recuerdos. Añade una nota y fotos.` }),
    campo("Nota", nota),
    campo("Lugar (texto libre)", lugar),
    sitio.nodo,
    campo("Fotos", fotos.nodo),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-plano", onclick: cerrarModal }, "Ahora no"),
      guardar
    )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    vibrar(); // al tocar, no al terminar: en iPhone el háptico solo vale dentro del toque
    guardar.disabled = true;
    guardar.textContent = "Guardando…";
    try {
      const fotosBlobs = await comprimirVarias(fotos.archivos());
      const coords = sitio.valor();
      const ubicacion =
        lugar.value.trim() || coords
          ? { texto: lugar.value.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null }
          : null;
      await completarPlan(plan, { nota: nota.value, ubicacion, fotosBlobs }, store.persona.id);
      cerrarModal();
      aviso("Recuerdo guardado 💛");
      lanzarConfeti();
    } catch (err) {
      console.error(err);
      aviso(mensajeError(err), "error");
      guardar.disabled = false;
      guardar.textContent = "Guardar recuerdo";
    }
  });

  abrirModal(form);
}

// ---- Helpers de formulario ----------------------------------------

// <label> solo si dentro hay un unico control: con varios botones (fotos),
// en iPhone un toque en cualquier parte del label pulsaria el primero.
function campo(etiqueta, control) {
  const tag = control.matches?.("input, textarea, select") ? "label" : "div";
  return el(tag, { class: "campo" },
    el("span", { class: "campo-et", text: etiqueta }),
    control
  );
}

function lanzarConfeti() {
  const capa = el("div", { class: "confeti" });
  for (let i = 0; i < 26; i++) {
    const p = el("i", { style: `left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.3}s;background:hsl(${Math.random() * 60 + 10},80%,65%)` });
    capa.append(p);
  }
  document.body.append(capa);
  setTimeout(() => capa.remove(), 2200);
}
