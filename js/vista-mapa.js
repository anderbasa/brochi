// Mapa de recuerdos, a pantalla completa como en Mapas/Fotos de iOS:
// - cada recuerdo es un pin con su foto; los que estan cerca se juntan en
//   una burbuja con el numero (Leaflet.markercluster) y se separan al acercar
// - abajo, un carrusel de tarjetas: deslizarlo lleva el mapa a cada recuerdo
//   y tocar un pin lleva el carrusel a su tarjeta
// - los recuerdos sin sitio se pueden poner en el mapa desde aqui mismo

import { store, observarSalida } from "./app.js";
import { el, limpiar, abrirModal, cerrarModal, aviso, mensajeError, vibrar, fechaTS, fechaLegible, fechaRelativa } from "./ui.js";
import { editarRecuerdo } from "./firebase.js";
import { verRecuerdo } from "./vista-recuerdos.js";
import { capaTeselas, CENTRO_INICIAL, ZOOM_INICIAL } from "./mapa-comun.js";
import { elegirUbicacion } from "./selector-mapa.js";

const ICONOS = {
  todos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/></svg>',
  yo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 3.7 3.9 10.4a.6.6 0 0 0 .1 1.1l6.6 1.9 1.9 6.6a.6.6 0 0 0 1.1.1l6.7-16.4z"/></svg>',
};

// El mapa que se ve ahora mismo. Cada vez que se pinta la pestana se crea uno
// nuevo, y la limpieza de la vista anterior (que llega un poco despues) solo
// debe quitar el suyo, no este.
let mapaActivo = null;
let pendiente = null; // recuerdo a enfocar al abrir el mapa (desde el detalle)

// Desde el detalle de un recuerdo: "Ver en el mapa"
export function verEnMapa(id) {
  pendiente = id;
  cerrarModal();
  if (location.hash === "#mapa" && mapaActivo) mapaActivo.fire("enfocar");
  else location.hash = "#mapa";
}

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function renderMapa(cont) {
  limpiar(cont);
  if (typeof L === "undefined") {
    cont.append(el("div", { class: "vacio" }, el("p", { text: "No se pudo cargar el mapa (sin conexión)." })));
    return;
  }

  const caja = el("div", { class: "mapa-caja" });
  const chip = el("div", { class: "mapa-chip cristal" });
  const sinSitio = el("button", { type: "button", class: "mapa-sin-sitio cristal", onclick: () => listaSinSitio() });
  const carrusel = el("div", { class: "mapa-carrusel" });
  const pantalla = el("div", { class: "mapa-pantalla" },
    caja,
    el("div", { class: "mapa-arriba" },
      el("div", { class: "mapa-chips" }, chip, sinSitio),
      el("div", { class: "mapa-botones cristal" },
        el("button", { type: "button", "aria-label": "Ver todos los recuerdos", html: ICONOS.todos, onclick: () => { vibrar(10); verTodos(true); } }),
        el("button", { type: "button", "aria-label": "Mi ubicación", class: "btn-yo", html: ICONOS.yo, onclick: (e) => irAMiUbicacion(e.currentTarget) })
      )
    ),
    carrusel
  );
  cont.append(pantalla);
  document.documentElement.classList.add("en-mapa");

  // El mapa va del final de la barra de arriba hasta abajo del todo; la
  // barra de pestanas queda encima, translucida, como en Mapas.
  const medir = () => {
    const arriba = document.querySelector(".topbar")?.offsetHeight || 56;
    const abajo = document.querySelector(".tabbar")?.offsetHeight || 64;
    pantalla.style.top = arriba + "px";
    pantalla.style.setProperty("--abajo", abajo + "px");
  };
  medir();

  const marcadores = new Map(); // id -> marker
  let grupo = null;
  let activo = null;
  let firma = "";
  let primeraVez = true;
  let puntoYo = null;
  let tScroll, tIgnorar, ignorarScroll = false;
  let vivo = true;

  const mapa = L.map(caja, { zoomControl: false, attributionControl: false }).setView(CENTRO_INICIAL, ZOOM_INICIAL);
  mapaActivo = mapa;
  capaTeselas().addTo(mapa);
  L.control.attribution({ position: "bottomleft", prefix: false }).addTo(mapa);
  mapa.on("enfocar", () => enfocarPendiente());

  const conSitio = () => store.recuerdos.filter((r) => r.ubicacion?.lat != null);
  const altoCarrusel = () => (carrusel.offsetHeight || 0) + 12;

  // centra un punto en el trozo de mapa que queda libre encima del carrusel
  function centrar(latlng, zoom = mapa.getZoom()) {
    const p = mapa.project(latlng, zoom).add([0, altoCarrusel() / 2]);
    mapa.flyTo(mapa.unproject(p, zoom), zoom, { duration: 0.8 });
  }

  function verTodos(animado) {
    const lista = conSitio();
    if (!lista.length) return;
    const limites = L.latLngBounds(lista.map((r) => [r.ubicacion.lat, r.ubicacion.lng]));
    const opciones = { paddingTopLeft: [40, 90], paddingBottomRight: [40, altoCarrusel() + 30], maxZoom: 15 };
    if (animado) mapa.flyToBounds(limites, { ...opciones, duration: 0.9 });
    else mapa.fitBounds(limites, opciones);
  }

  function iconoRecuerdo(r) {
    const foto = r.fotos?.[0];
    return L.divIcon({
      className: "pin-recuerdo",
      html: `<div class="pin-foto">${foto ? `<img src="${attr(foto)}" alt="">` : "<span>📸</span>"}</div>`,
      iconSize: [56, 64],
      iconAnchor: [28, 64],
    });
  }

  function crearGrupo() {
    if (!L.markerClusterGroup) return L.featureGroup(); // sin la libreria: pines sueltos
    return L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      spiderfyDistanceMultiplier: 1.8,
      iconCreateFunction(cluster) {
        const foto = cluster.getAllChildMarkers().map((m) => m.options.foto).find(Boolean);
        return L.divIcon({
          className: "pin-recuerdo",
          html: `<div class="pin-foto pin-grupo">${foto ? `<img src="${attr(foto)}" alt="">` : "<span>📸</span>"}<b>${cluster.getChildCount()}</b></div>`,
          iconSize: [60, 68],
          iconAnchor: [30, 68],
        });
      },
    });
  }

  function pintar() {
    const lista = conSitio();
    const sin = store.recuerdos.length - lista.length;
    chip.textContent = lista.length
      ? `${lista.length} ${lista.length === 1 ? "recuerdo" : "recuerdos"} en el mapa`
      : "Aún no hay recuerdos en el mapa";
    sinSitio.hidden = !sin;
    sinSitio.textContent = `📍 ${sin} sin sitio · Ponlos`;

    // Solo se rehace si ha cambiado algo que se vea (si no, cada ❤️ o plan
    // nuevo devolveria el carrusel al principio)
    const nueva = JSON.stringify(lista.map((r) => [r.id, r.titulo, r.fotos?.[0], r.ubicacion.lat, r.ubicacion.lng, r.ubicacion.texto]));
    if (nueva === firma) return;
    firma = nueva;

    if (grupo) mapa.removeLayer(grupo);
    marcadores.clear();
    grupo = crearGrupo();
    lista.forEach((r) => {
      const m = L.marker([r.ubicacion.lat, r.ubicacion.lng], { icon: iconoRecuerdo(r), foto: r.fotos?.[0] });
      m.on("click", () => { vibrar(10); seleccionar(r.id, { desplazar: true }); });
      marcadores.set(r.id, m);
      grupo.addLayer(m);
    });
    grupo.addTo(mapa);
    grupo.on("animationend spiderfied", marcarActivo);

    limpiar(carrusel);
    if (!lista.length) {
      carrusel.append(el("div", { class: "mc mc-vacio cristal" },
        el("div", { class: "mc-txt" },
          el("strong", { text: store.recuerdos.length ? "Vuestros sitios aparecerán aquí" : "Aún no hay recuerdos" }),
          el("span", { text: store.recuerdos.length
            ? "Toca «sin sitio», arriba, para poner vuestros recuerdos en el mapa."
            : "Completa un plan de la lista y guarda dónde fue." })
        )
      ));
    } else {
      lista.forEach((r) => {
        const foto = r.fotos?.[0];
        carrusel.append(el("button", { type: "button", class: "mc cristal", "data-id": r.id, onclick: () => tocarTarjeta(r.id) },
          foto ? el("img", { src: foto, alt: "", loading: "lazy" }) : el("div", { class: "mc-sin-foto", text: "📸" }),
          el("div", { class: "mc-txt" },
            el("strong", { text: r.titulo }),
            r.ubicacion.texto && el("span", { class: "mc-lugar", text: r.ubicacion.texto }),
            el("span", { text: fechaRelativa(r.creadoEn) })
          )
        ));
      });
    }

    if (activo && !marcadores.has(activo)) activo = null;
    if (pendiente && marcadores.has(pendiente)) enfocarPendiente();
    else if (primeraVez) {
      verTodos(false);
      if (lista.length) seleccionar(lista[0].id, { mover: false });
    } else if (activo) seleccionar(activo, { mover: false, desplazar: true });
    primeraVez = false;
  }

  function enfocarPendiente() {
    const id = pendiente;
    if (!id || !marcadores.has(id)) return;
    pendiente = null;
    seleccionar(id, { desplazar: true, zoom: 16 });
  }

  // Marca la tarjeta y el pin del recuerdo activo, lleva el mapa hasta el y
  // (si hace falta) desliza el carrusel hasta su tarjeta.
  function seleccionar(id, { mover = true, desplazar = false, zoom = 12 } = {}) {
    activo = id;
    carrusel.querySelectorAll(".mc").forEach((t) => t.classList.toggle("activa", t.dataset.id === id));
    if (desplazar) {
      const t = carrusel.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (t) {
        ignorarScroll = true;
        carrusel.scrollTo({ left: t.offsetLeft - (carrusel.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
        clearTimeout(tIgnorar);
        tIgnorar = setTimeout(() => (ignorarScroll = false), 700);
      }
    }
    const m = marcadores.get(id);
    if (m && mover) {
      // si el pin esta dentro de una burbuja, primero se abre la burbuja
      const suelto = !grupo.getVisibleParent || grupo.getVisibleParent(m) === m;
      if (suelto) centrar(m.getLatLng(), Math.max(mapa.getZoom(), zoom));
      else grupo.zoomToShowLayer(m, () => { centrar(m.getLatLng()); marcarActivo(); });
    }
    marcarActivo();
  }

  function marcarActivo() {
    marcadores.forEach((m, id) => {
      m.getElement()?.classList.toggle("activo", id === activo);
      m.setZIndexOffset(id === activo ? 1000 : 0);
    });
  }
  mapa.on("zoomend moveend", marcarActivo);

  function tocarTarjeta(id) {
    if (id === activo) { vibrar(10); verRecuerdo(id); }
    else seleccionar(id, { desplazar: true });
  }

  // Al deslizar el carrusel, la tarjeta que se queda en el centro manda
  carrusel.addEventListener("scroll", () => {
    if (ignorarScroll) return;
    clearTimeout(tScroll);
    tScroll = setTimeout(() => {
      const centro = carrusel.scrollLeft + carrusel.clientWidth / 2;
      let mejor = null, dist = Infinity;
      carrusel.querySelectorAll(".mc[data-id]").forEach((t) => {
        const d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - centro);
        if (d < dist) { dist = d; mejor = t; }
      });
      if (mejor && mejor.dataset.id !== activo) seleccionar(mejor.dataset.id);
    }, 110);
  }, { passive: true });

  function irAMiUbicacion(boton) {
    if (!navigator.geolocation) return;
    boton.classList.add("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        boton.classList.remove("buscando");
        if (!vivo) return;
        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (puntoYo) puntoYo.setLatLng(ll);
        else puntoYo = L.marker(ll, { icon: L.divIcon({ className: "punto-yo", html: "<i></i>", iconSize: [22, 22] }), interactive: false, zIndexOffset: 2000 }).addTo(mapa);
        centrar(ll, Math.max(mapa.getZoom(), 14));
      },
      () => { boton.classList.remove("buscando"); aviso("No se pudo saber dónde estás", "error"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // El contenedor ya esta en la pagina (el router lo mete antes de pintar la
  // vista), asi que los pines se pintan ya; el tamano se reajusta en el
  // siguiente fotograma por si la barra de arriba aun no tenia su alto final.
  pintar();
  requestAnimationFrame(() => {
    if (!vivo) return;
    medir();
    mapa.invalidateSize();
  });

  const off = store.onChange(() => vivo && pintar());
  addEventListener("resize", medir);
  observarSalida(cont, () => {
    vivo = false;
    off();
    removeEventListener("resize", medir);
    if (!document.querySelector(".mapa-pantalla")) document.documentElement.classList.remove("en-mapa");
    mapa.remove();
    if (mapaActivo === mapa) mapaActivo = null;
  });
}

// ---- Recuerdos sin sitio ----------------------------------------------

function listaSinSitio() {
  const lista = store.recuerdos.filter((r) => r.ubicacion?.lat == null);
  if (!lista.length) return;
  abrirModal(el("div", { class: "sin-sitio" },
    el("h3", { text: "Recuerdos sin sitio" }),
    el("p", { class: "form-sub", text: "Elige uno y coloca el pin donde fue. Se puede hacer cuando sea, aunque haya pasado tiempo." }),
    el("div", { class: "sin-sitio-lista" },
      ...lista.map((r) =>
        el("button", { type: "button", class: "fila-sin-sitio", onclick: () => ponerEnMapa(r) },
          r.fotos?.[0] ? el("img", { src: r.fotos[0], alt: "", loading: "lazy" }) : el("span", { class: "sin-foto-mini", text: "📸" }),
          el("span", { class: "fila-sin-sitio-txt" },
            el("strong", { text: r.titulo }),
            el("span", { text: [r.ubicacion?.texto, fechaLegible(fechaTS(r.creadoEn))].filter(Boolean).join(" · ") })
          ),
          el("span", { class: "fila-sin-sitio-ir", text: "Poner ›" })
        )
      )
    )
  ));
}

async function ponerEnMapa(r) {
  const elegido = await elegirUbicacion({ titulo: r.titulo });
  if (!elegido) return;
  try {
    await editarRecuerdo(r.id, {
      ubicacion: { texto: r.ubicacion?.texto || elegido.texto || "", lat: elegido.lat, lng: elegido.lng },
    });
    pendiente = r.id;
    cerrarModal();
    aviso("¡Ya está en el mapa! 📍");
    if (mapaActivo) mapaActivo.fire("enfocar");
  } catch (err) {
    console.error(err);
    aviso(mensajeError(err), "error");
  }
}
