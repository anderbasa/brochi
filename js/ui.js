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

// ---- Selector de ubicación (mapa con pin) ----------------------------

// Mapa pequeño con un pin que se puede tocar/arrastrar, MÁS un buscador de
// sitios por nombre (Nominatim/OpenStreetMap, gratis y sin API key) para
// marcar cualquier lugar sin depender de acertar el punto exacto con el
// dedo. "Usar mi ubicación actual" sigue disponible como atajo cuando de
// verdad se está en el sitio. Devuelve { nodo, valor() → {lat,lng}|null }.
export function campoUbicacion({ lat = null, lng = null, onLugar } = {}) {
  let valor = lat != null && lng != null ? { lat, lng } : null;
  const CENTRO_DEFECTO = [40.4168, -3.7038]; // España, solo para encuadrar si no hay pin

  const ayuda = el("p", {
    class: "mapa-mini-ayuda",
    text: valor
      ? "Arrastra el pin o toca el mapa para moverlo."
      : "Toca el mapa para marcar dónde fue, o busca el sitio abajo.",
  });
  const caja = el("div", { class: "mapa-mini" });
  const btnQuitar = el(
    "button",
    { type: "button", class: "btn-plano", hidden: !valor, onclick: () => quitarPin() },
    "Quitar ubicación del mapa"
  );
  const btnGeo = el(
    "button",
    { type: "button", class: "btn-foto", onclick: () => irAMiUbicacion() },
    "📍 Usar mi ubicación actual"
  );

  // Buscador de sitios por nombre — la alternativa pedida a "toca el mapa"
  // para cuando se quiere marcar un lugar cualquiera con precisión.
  const buscarInput = el("input", {
    type: "text",
    placeholder: "O busca un sitio (ej. Torre Eiffel, París)",
  });
  const buscarBtn = el("button", { type: "button", class: "btn-plano", onclick: () => buscar() }, "Buscar");
  const resultados = el("div", { class: "resultados-busqueda" });
  buscarInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // no debe enviar el formulario que la contiene
      buscar();
    }
  });

  async function buscar() {
    const q = buscarInput.value.trim();
    if (!q) return;
    limpiar(resultados);
    buscarBtn.disabled = true;
    buscarBtn.textContent = "Buscando…";
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { "Accept-Language": "es" } });
      if (!resp.ok) throw new Error("respuesta " + resp.status);
      const datos = await resp.json();
      if (!datos.length) {
        resultados.append(el("p", { class: "resultados-vacio", text: "Sin resultados para ese nombre." }));
        return;
      }
      datos.forEach((d) => {
        resultados.append(
          el(
            "button",
            { type: "button", class: "resultado-busqueda", onclick: () => elegirResultado(d) },
            d.display_name
          )
        );
      });
    } catch (_) {
      resultados.append(el("p", { class: "resultados-vacio", text: "No se pudo buscar (revisa tu conexión)." }));
    } finally {
      buscarBtn.disabled = false;
      buscarBtn.textContent = "Buscar";
    }
  }

  function elegirResultado(d) {
    const la = parseFloat(d.lat);
    const ln = parseFloat(d.lon);
    if (mapa) mapa.setView([la, ln], 15);
    ponerPin(la, ln);
    limpiar(resultados);
    buscarInput.value = "";
    if (onLugar) onLugar(d.display_name.split(",").slice(0, 3).join(",").trim());
  }

  let mapa, marker;

  function ponerPin(la, ln) {
    valor = { lat: +la.toFixed(6), lng: +ln.toFixed(6) };
    if (!marker) {
      marker = L.marker([la, ln], { draggable: true }).addTo(mapa);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        valor = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) };
      });
    } else {
      marker.setLatLng([la, ln]);
    }
    btnQuitar.hidden = false;
    ayuda.textContent = "Arrastra el pin o toca el mapa para moverlo.";
  }

  function quitarPin() {
    if (marker && mapa) mapa.removeLayer(marker);
    marker = null;
    valor = null;
    btnQuitar.hidden = true;
    ayuda.textContent = "Toca el mapa para marcar dónde fue, o usa tu ubicación actual.";
  }

  function irAMiUbicacion() {
    if (!navigator.geolocation) {
      aviso("Este móvil no da ubicación", "error");
      return;
    }
    btnGeo.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: la, longitude: ln } = pos.coords;
        if (mapa) mapa.setView([la, ln], 15);
        ponerPin(la, ln);
        btnGeo.disabled = false;
      },
      (err) => {
        btnGeo.disabled = false;
        aviso(err.code === 1 ? "Permiso de ubicación denegado" : "No se pudo obtener tu ubicación", "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (typeof L === "undefined") {
    ayuda.textContent = "No se pudo cargar el mapa (sin conexión) — puedes seguir escribiendo el lugar en texto.";
  } else {
    requestAnimationFrame(() => {
      mapa = L.map(caja, { scrollWheelZoom: false }).setView(
        valor ? [valor.lat, valor.lng] : CENTRO_DEFECTO,
        valor ? 14 : 5
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapa);
      if (valor) ponerPin(valor.lat, valor.lng);
      mapa.on("click", (e) => ponerPin(e.latlng.lat, e.latlng.lng));
    });
  }

  return {
    nodo: el(
      "div",
      { class: "campo-ubicacion" },
      ayuda,
      caja,
      el("div", { class: "geo-fila" }, btnGeo, btnQuitar),
      el("div", { class: "busqueda-ubicacion" }, buscarInput, buscarBtn),
      resultados
    ),
    valor: () => valor,
  };
}
