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

// ---- Hojas (modales) al estilo iOS ---------------------------------------
//
// En el movil son hojas que suben desde abajo, con su barrita, y se cierran
// arrastrandolas hacia abajo como las de iOS. Si ya hay una hoja abierta, la
// nueva NO la cierra y vuelve a abrir: cambia el contenido en el sitio (asi
// pasar del detalle de un recuerdo a "Editar", o "Otro" en Sorprendeme, no
// hace bajar y subir la hoja cada vez).

let modalAbierto = null;

export function abrirModal(contenido, { onCerrar } = {}) {
  if (modalAbierto) {
    const anterior = modalAbierto.onCerrar;
    modalAbierto.onCerrar = onCerrar;
    if (anterior) anterior();
    const { panel } = modalAbierto;
    limpiar(panel);
    panel.append(el("div", { class: "modal-asa" }), contenido);
    panel.scrollTop = 0;
    return { cerrar: cerrarModal };
  }
  const panel = el("div", { class: "modal-panel", role: "dialog", "aria-modal": "true" },
    el("div", { class: "modal-asa" }), contenido);
  const fondo = el("div", { class: "modal-fondo" }, panel);
  fondo.addEventListener("click", (e) => {
    if (e.target === fondo) cerrarModal();
  });
  const escHandler = (e) => e.key === "Escape" && cerrarModal();
  document.addEventListener("keydown", escHandler);
  document.body.appendChild(fondo);
  document.body.style.overflow = "hidden";
  fondo.getBoundingClientRect(); // fija el estado inicial para que la entrada se anime
  fondo.classList.add("visible");
  activarArrastre(panel, fondo);
  modalAbierto = { fondo, panel, escHandler, onCerrar };
  return { cerrar: cerrarModal };
}

export function cerrarModal() {
  if (!modalAbierto) return;
  const { fondo, escHandler, onCerrar } = modalAbierto;
  document.removeEventListener("keydown", escHandler);
  fondo.classList.remove("visible");
  document.body.style.overflow = "";
  setTimeout(() => fondo.remove(), 460);
  modalAbierto = null;
  if (onCerrar) onCerrar();
}

// Deslizar hacia abajo para cerrar. Solo empieza si la hoja esta arriba del
// todo (si no, el gesto es el scroll normal del contenido) o si se agarra
// por la barrita.
function activarArrastre(panel, fondo) {
  let y0 = null, dy = 0, t0 = 0, arrastrando = false;
  panel.addEventListener("touchstart", (e) => {
    if (window.innerWidth >= 560 || e.touches.length > 1) return;
    const enAsa = e.target.closest(".modal-asa");
    if (panel.scrollTop > 0 && !enAsa) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); arrastrando = false;
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (!arrastrando) {
      if (dy > 8) { arrastrando = true; panel.classList.add("arrastrando"); }
      else if (dy < -4) { y0 = null; return; } // hacia arriba: scroll normal
      else return;
    }
    e.preventDefault();
    // un poco de resistencia, como en iOS
    const d = dy > 0 ? dy : dy / 4;
    panel.style.transform = `translateY(${d}px)`;
    fondo.style.opacity = String(Math.max(0.3, 1 - Math.max(0, dy) / 500));
  }, { passive: false });
  const fin = () => {
    if (y0 === null) return;
    const velocidad = dy / Math.max(1, Date.now() - t0);
    y0 = null;
    if (!arrastrando) return;
    arrastrando = false;
    panel.classList.remove("arrastrando");
    const cerrar = dy > 130 || (dy > 40 && velocidad > 0.5);
    // en el mismo instante: quitar el desplazamiento a mano y (si toca)
    // cerrar, para que la transicion salga desde donde quedo el dedo
    panel.style.transform = "";
    fondo.style.opacity = "";
    if (cerrar) cerrarModal();
  };
  panel.addEventListener("touchend", fin);
  panel.addEventListener("touchcancel", fin);
}

// ---- Avisos en directo (estilo notificacion de iOS) --------------------
//
// Bajan desde arriba de uno en uno, se van solos a los ~4 s, se cierran
// deslizando hacia arriba y al tocarlos llevan a lo que avisan.

const colaAvisos = [];
let avisoEnPantalla = false;

export function notificacion({ titulo, texto = "", alTocar = null }) {
  colaAvisos.push({ titulo, texto, alTocar });
  if (!avisoEnPantalla) siguienteNotificacion();
}

function siguienteNotificacion() {
  const n = colaAvisos.shift();
  if (!n) { avisoEnPantalla = false; return; }
  avisoEnPantalla = true;

  const tarjeta = el("div", { class: "notif", role: "status", "aria-live": "polite" },
    el("img", { src: "icons/icon-192.png", alt: "" }),
    el("div", { class: "notif-cuerpo" },
      el("div", { class: "notif-cab" }, el("span", { text: "Nuestra lista" }), el("span", { text: "ahora" })),
      el("div", { class: "notif-tit", text: n.titulo }),
      n.texto && el("div", { class: "notif-txt", text: n.texto })
    )
  );
  document.body.append(tarjeta);
  tarjeta.getBoundingClientRect();
  tarjeta.classList.add("visible");

  let cerrada = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    clearTimeout(temporizador);
    tarjeta.classList.remove("visible");
    setTimeout(() => { tarjeta.remove(); siguienteNotificacion(); }, 450);
  };
  const temporizador = setTimeout(cerrar, colaAvisos.length ? 3000 : 4200);

  let y0 = null, movido = false;
  tarjeta.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; movido = false; }, { passive: true });
  tarjeta.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    const dy = e.touches[0].clientY - y0;
    if (Math.abs(dy) > 6) movido = true;
    e.preventDefault();
    tarjeta.classList.add("arrastrando");
    tarjeta.style.transform = `translateY(${dy < 0 ? dy : dy / 5}px)`;
  }, { passive: false });
  tarjeta.addEventListener("touchend", (e) => {
    if (y0 === null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    tarjeta.classList.remove("arrastrando");
    tarjeta.style.transform = "";
    if (dy < -25) cerrar();
  });
  tarjeta.addEventListener("click", () => {
    if (movido) return;
    cerrar();
    if (n.alTocar) n.alTocar();
  });
}

// ---- Explosion de corazones -------------------------------------------

// Lanza unos corazones desde el centro de `origen` (un elemento del DOM).
export function explosionCorazones(origen, cuantos = 10) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = origen.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const tipos = ["❤️", "❤️", "🧡", "💕"];
  for (let i = 0; i < cuantos; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const dist = 50 + Math.random() * 70;
    const c = el("span", {
      class: "chispa",
      "aria-hidden": "true",
      style: [
        `--x:${x}px`, `--y:${y}px`,
        `--dx:${Math.cos(ang) * dist}px`, `--dy:${Math.sin(ang) * dist}px`,
        `--giro:${Math.round((Math.random() - 0.5) * 70)}deg`,
        `--t:${14 + Math.round(Math.random() * 12)}px`,
        `--retraso:${(Math.random() * 0.08).toFixed(2)}s`,
      ].join(";"),
    }, tipos[i % tipos.length]);
    document.body.append(c);
    setTimeout(() => c.remove(), 1100);
  }
  origen.classList.remove("latiendo");
  void origen.offsetWidth;
  origen.classList.add("latiendo");
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

// Fecha relativa para cosas recientes ("hoy", "hace 3 días"...), y la fecha
// legible normal para todo lo demás — así las tarjetas de Recuerdos se leen
// más natural sin perder precisión cuando ya ha pasado tiempo.
export function fechaRelativa(d) {
  const f = d instanceof Date ? d : fechaTS(d);
  if (!f) return "";
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioF = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const dias = Math.round((inicioHoy - inicioF) / 86400000);
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias > 1 && dias < 7) return `hace ${dias} días`;
  if (dias >= 7 && dias < 14) return "hace 1 semana";
  if (dias >= 14 && dias < 30) return `hace ${Math.floor(dias / 7)} semanas`;
  return fechaLegible(f);
}

// Días juntos desde FECHA_INICIO (config.js), para el contador de Inicio.
export function diasDesde(fechaISO) {
  if (!fechaISO) return null;
  const [y, m, d] = fechaISO.split("-").map(Number);
  const inicio = new Date(y, m - 1, d);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.round((inicioHoy - inicio) / 86400000));
}

// Días HASTA una fecha objetivo (puede ser negativo si ya pasó) — para el
// countdown grande de Inicio. A diferencia de diasDesde(), aquí el signo
// importa.
export function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const [y, m, d] = fechaISO.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((obj - inicioHoy) / 86400000);
}

// Toque háptico corto como confirmación física.
// - Android: navigator.vibrate().
// - iPhone: Safari no tiene vibrate(), pero desde iOS 18 un interruptor
//   nativo (<input type="checkbox" switch>) da un "tic" háptico al cambiar
//   de estado, igual que los de Ajustes. Hay uno invisible en la pagina y se
//   pulsa su etiqueta.
//   - Tiene que llamarse DURANTE el toque del usuario (en el onclick, antes
//     de cualquier await): por eso las vistas lo llaman al principio.
//   - El interruptor esta en <body>, pintado (opacidad casi 0, no
//     display:none) y no se borra: un primer intento lo creaba en <head> con
//     display:none y lo quitaba al instante, y en un iPhone real no vibraba.
//   - Necesita "Vibración del sistema" activada en Ajustes > Sonidos y
//     vibraciones del iPhone.
const ES_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let etiquetaHaptica = null;
function interruptorHaptico() {
  if (etiquetaHaptica && etiquetaHaptica.isConnected) return etiquetaHaptica;
  etiquetaHaptica = document.createElement("label");
  etiquetaHaptica.setAttribute("aria-hidden", "true");
  etiquetaHaptica.style.cssText =
    "position:fixed;left:0;bottom:0;width:52px;height:32px;opacity:0.011;" +
    "pointer-events:none;z-index:-1;overflow:hidden";
  const interruptor = document.createElement("input");
  interruptor.type = "checkbox";
  interruptor.setAttribute("switch", "");
  interruptor.tabIndex = -1;
  etiquetaHaptica.append(interruptor);
  document.body.append(etiquetaHaptica);
  return etiquetaHaptica;
}
export function vibrar(patron = 30) {
  try {
    if (navigator.vibrate) { navigator.vibrate(patron); return; }
    if (!ES_IOS) return;
    interruptorHaptico().click();
  } catch (_) {}
}
// Se crea en cuanto carga la pagina, para que ya este pintado en el primer
// toque (si se crea en ese mismo toque puede que iOS no llegue a vibrar).
if (ES_IOS) {
  if (document.body) interruptorHaptico();
  else addEventListener("DOMContentLoaded", interruptorHaptico, { once: true });
}

// ---- Skeleton (siluetas de carga) ------------------------------------

export function skeleton(lineas = 3) {
  const cont = el("div", { class: "skeleton" });
  for (let i = 0; i < lineas; i++) {
    cont.append(el("div", { class: "skeleton-bloque" }));
  }
  return cont;
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

// ---- Menu al mantener pulsado (el "Haptic Touch" de iOS) ------------------
//
// Al mantener el dedo, la tarjeta se hunde un poco; al rato "salta" hacia
// arriba, el resto de la pantalla se desenfoca y aparece un menu debajo.
// `opciones()` devuelve [{ texto, icono, accion, peligro }] (null = se salta).
// En el ordenador sale con el boton derecho.

const ESPERA_MENU = 450;

export function menuContextual(nodo, opciones) {
  let t = null, inicio = null, disparado = false;
  const cancelar = () => { clearTimeout(t); nodo.classList.remove("presionando"); inicio = null; };

  nodo.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return cancelar();
    disparado = false;
    inicio = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    nodo.classList.add("presionando");
    t = setTimeout(() => {
      disparado = true;
      nodo.classList.remove("presionando");
      abrirMenuContextual(nodo, opciones());
    }, ESPERA_MENU);
  }, { passive: true });
  nodo.addEventListener("touchmove", (e) => {
    if (inicio && Math.hypot(e.touches[0].clientX - inicio.x, e.touches[0].clientY - inicio.y) > 10) cancelar();
  }, { passive: true });
  nodo.addEventListener("touchend", (e) => {
    cancelar();
    if (disparado) e.preventDefault(); // sin el "click" de despues: no abre la tarjeta
  });
  nodo.addEventListener("touchcancel", cancelar);
  // por si algun navegador manda el click igualmente
  nodo.addEventListener("click", (e) => {
    if (!disparado) return;
    disparado = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  nodo.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    cancelar();
    abrirMenuContextual(nodo, opciones());
  });
}

function abrirMenuContextual(nodo, opciones) {
  if (document.querySelector(".menu-ctx") || !nodo.isConnected) return;
  const items = opciones.filter(Boolean);
  if (!items.length) return;
  vibrar(12);

  const r = nodo.getBoundingClientRect();
  const copia = nodo.cloneNode(true);
  copia.classList.remove("presionando");
  copia.classList.add("menu-ctx-copia");
  copia.setAttribute("aria-hidden", "true");
  copia.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;

  const lista = el("div", { class: "menu-ctx-lista", role: "menu" },
    ...items.map((it) =>
      el("button", {
        type: "button",
        role: "menuitem",
        class: it.peligro ? "peligro" : "",
        onclick: () => { cerrar(); it.accion(); },
      },
        el("span", { text: it.texto }),
        el("span", { class: "menu-ctx-ico", text: it.icono || "" })
      )
    )
  );
  const fondo = el("div", { class: "menu-ctx-fondo", onclick: () => cerrar() });
  const capa = el("div", { class: "menu-ctx" }, fondo, copia, lista);
  document.body.append(capa);

  // Donde va cada cosa: la tarjeta crece un poco y el menu va debajo, del
  // lado en el que esta la tarjeta. Si no cabe, todo sube (como en iOS).
  const margen = 14;
  const arriba = Math.max(margen, document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0) + 6; // no tapar la isla ni la barra
  const altoMenu = lista.offsetHeight, anchoMenu = lista.offsetWidth;
  const escala = Math.min(1.04, (innerHeight - arriba - margen - altoMenu - 12) / r.height);
  const altoTarjeta = r.height * escala;
  let top = r.top + (r.height - altoTarjeta) / 2;
  const sobra = top + altoTarjeta + 12 + altoMenu - (innerHeight - margen);
  if (sobra > 0) top -= sobra;
  top = Math.max(arriba, top);
  const dy = top - (r.top + (r.height - altoTarjeta) / 2);
  const izquierda = r.left + r.width / 2 < innerWidth / 2;
  const x = izquierda ? Math.max(margen, r.left) : Math.min(innerWidth - margen - anchoMenu, r.right - anchoMenu);
  lista.style.left = x + "px";
  lista.style.top = top + altoTarjeta + 12 + "px";
  lista.style.transformOrigin = izquierda ? "top left" : "top right";
  copia.style.setProperty("--dy", dy + "px");
  copia.style.setProperty("--escala", escala);

  nodo.style.visibility = "hidden";
  capa.getBoundingClientRect();
  capa.classList.add("visible");

  const teclas = (e) => e.key === "Escape" && cerrar();
  document.addEventListener("keydown", teclas);
  let cerrado = false;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener("keydown", teclas);
    capa.classList.remove("visible");
    setTimeout(() => { capa.remove(); nodo.style.visibility = ""; }, 320);
  }
}

// ---- Numeros que cuentan hasta su valor -------------------------------------
export function contarHasta(nodo, final, duracion = 900) {
  if (!(final > 1) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / duracion);
    nodo.textContent = String(Math.round(final * (1 - Math.pow(1 - k, 3))));
    if (k < 1 && nodo.isConnected) requestAnimationFrame(paso);
  };
  nodo.textContent = "0";
  requestAnimationFrame(paso);
}
