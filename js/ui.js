// Utilidades de interfaz compartidas por todas las vistas.

export function el(tag, attrs = {}, ...hijos) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    node.append(h.nodeType ? h : document.createTextNode(h));
  }
  return node;
}

export function limpiar(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---- Modal --------------------------------------------------------------

let modalAbierto = null;

export function abrirModal(contenido, { onCerrar } = {}) {
  cerrarModal();
  const panel = el("div", { class: "modal-panel", role: "dialog", "aria-modal": "true" }, contenido);
  const fondo = el("div", { class: "modal-fondo" }, panel);
  fondo.addEventListener("click", (e) => {
    if (e.target === fondo) cerrarModal();
  });
  const escHandler = (e) => e.key === "Escape" && cerrarModal();
  document.addEventListener("keydown", escHandler);
  document.body.appendChild(fondo);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => fondo.classList.add("visible"));
  modalAbierto = { fondo, escHandler, onCerrar };
  return { cerrar: cerrarModal };
}

export function cerrarModal() {
  if (!modalAbierto) return;
  const { fondo, escHandler, onCerrar } = modalAbierto;
  document.removeEventListener("keydown", escHandler);
  fondo.classList.remove("visible");
  document.body.style.overflow = "";
  setTimeout(() => fondo.remove(), 200);
  modalAbierto = null;
  if (onCerrar) onCerrar();
}

// ---- Aviso corto (toast) ---------------------------------------------

// Mensaje corto y legible a partir de un error, para que el aviso diga el
// motivo real (p. ej. "el bucket no existe") en vez de un genérico e inútil.
export function mensajeError(err, prefijo = "No se pudo guardar") {
  const texto = (err && (err.message || err.error_description || err.error)) || String(err || "");
  return texto ? `${prefijo}: ${texto}`.slice(0, 160) : prefijo;
}

let toastTimer;
export function aviso(texto, tipo = "ok") {
  let t = document.querySelector(".toast");
  if (!t) {
    t = el("div", { class: "toast" });
    document.body.appendChild(t);
  }
  t.textContent = texto;
  t.dataset.tipo = tipo;
  t.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("visible"), tipo === "error" ? 6000 : 2800);
}

// ---- Confirmación -----------------------------------------------------

export function confirmar(mensaje, { textoOk = "Borrar", peligro = true } = {}) {
  return new Promise((resolve) => {
    const cont = el(
      "div",
      { class: "confirmar" },
      el("p", { text: mensaje }),
      el(
        "div",
        { class: "acciones" },
        el("button", { class: "btn-plano", onclick: () => (resolve(false), cerrarModal()) }, "Cancelar"),
        el(
          "button",
          {
            class: peligro ? "btn-peligro" : "btn-primario",
            // Resolver ANTES de cerrar: cerrarModal() dispara su propio
            // onCerrar (resolve(false)) y una Promise se queda con la
            // primera resolución — si cerráramos primero, "Borrar" también
            // acabaría resolviendo `false`.
            onclick: () => (resolve(true), cerrarModal()),
          },
          textoOk
        )
      )
    );
    abrirModal(cont, { onCerrar: () => resolve(false) });
  });
}

// ---- Fechas ---------------------------------------------------------

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaTS(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
}

export function fechaLegible(d) {
  const f = d instanceof Date ? d : fechaTS(d);
  if (!f) return "";
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

// Estado de una fecha objetivo: devuelve {texto, clase} o null.
export function cuentaAtras(fechaObjetivo) {
  if (!fechaObjetivo) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = fechaObjetivo.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  const dias = Math.round((obj - hoy) / 86400000);
  if (dias < 0) return { texto: "fecha pasada", clase: "pasada" };
  if (dias === 0) return { texto: "¡es hoy!", clase: "hoy" };
  if (dias === 1) return { texto: "¡mañana!", clase: "casi" };
  if (dias <= 7) return { texto: `en ${dias} días · ¡ya casi!`, clase: "casi" };
  if (dias <= 30) return { texto: `en ${dias} días`, clase: "lejos" };
  return { texto: fechaLegible(obj), clase: "lejos" };
}

// ---- Selector de fotos con vista previa ------------------------------

// Devuelve un objeto { nodo, archivos() } para insertar en un formulario.
// `archivos()` da la lista de File actuales (aún sin comprimir).
export function campoFotos({ multiple = true, etiqueta = "Añadir fotos" } = {}) {
  let files = [];
  const input = el("input", {
    type: "file",
    accept: "image/*",
    multiple: multiple || null,
    capture: null,
    class: "oculto-input",
  });
  const galeria = el("div", { class: "mini-galeria" });
  const boton = el(
    "button",
    { type: "button", class: "btn-foto", onclick: () => input.click() },
    `📷 ${etiqueta}`
  );

  function pintar() {
    limpiar(galeria);
    files.forEach((f, i) => {
      const url = URL.createObjectURL(f);
      const img = el("img", { src: url, alt: "", onload: () => URL.revokeObjectURL(url) });
      const quita = el(
        "button",
        {
          type: "button",
          class: "quita-foto",
          "aria-label": "Quitar",
          onclick: () => {
            files.splice(i, 1);
            pintar();
          },
        },
        "×"
      );
      galeria.append(el("div", { class: "mini-foto" }, img, quita));
    });
  }

  input.addEventListener("change", () => {
    const nuevos = Array.from(input.files).filter((f) => f.type.startsWith("image/"));
    files = multiple ? [...files, ...nuevos] : nuevos.slice(0, 1);
    input.value = "";
    pintar();
  });

  return {
    nodo: el("div", { class: "campo-fotos" }, boton, input, galeria),
    archivos: () => files,
  };
}
