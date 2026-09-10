// Mapa de recuerdos con Leaflet + OpenStreetMap (sin API key).
// Un pin por cada recuerdo que tenga coordenadas.

import { store, observarSalida } from "./app.js";
import { el, limpiar, abrirModal, fechaTS, fechaLegible } from "./ui.js";

let mapa;

export function renderMapa(cont) {
  limpiar(cont);
  const conUbi = () => store.recuerdos.filter((r) => r.ubicacion && r.ubicacion.lat != null);

  if (typeof L === "undefined") {
    cont.append(el("div", { class: "vacio" }, el("p", { text: "No se pudo cargar el mapa (sin conexión)." })));
    return;
  }

  const caja = el("div", { class: "mapa-caja", id: "mapa" });
  const pie = el("p", { class: "mapa-pie" });
  cont.append(caja, pie);

  const pintarPins = () => {
    if (!mapa) return;
    const lista = conUbi();
    pie.textContent = lista.length
      ? `${lista.length} ${lista.length === 1 ? "recuerdo" : "recuerdos"} en el mapa`
      : "Ningún recuerdo tiene ubicación todavía. Añádela al completar un plan o editando un recuerdo.";

    (mapa._pinLayer && mapa.removeLayer(mapa._pinLayer));
    if (!lista.length) return;

    const grupo = L.featureGroup();
    lista.forEach((r) => {
      const m = L.marker([r.ubicacion.lat, r.ubicacion.lng]);
      m.on("click", () => popupRecuerdo(r));
      m.bindTooltip(r.titulo, { direction: "top" });
      grupo.addLayer(m);
    });
    grupo.addTo(mapa);
    mapa._pinLayer = grupo;
    mapa.fitBounds(grupo.getBounds().pad(0.3), { maxZoom: 14 });
  };

  // Leaflet necesita que el contenedor exista y tenga tamaño.
  requestAnimationFrame(() => {
    mapa = L.map(caja, { scrollWheelZoom: true }).setView([40.4, -3.7], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(mapa);
    pintarPins();
  });

  const off = store.onChange(() => pintarPins());
  observarSalida(cont, () => {
    off();
    if (mapa) { mapa.remove(); mapa = null; }
  });
}

function popupRecuerdo(r) {
  const cont = el("div", { class: "detalle" },
    el("h3", { text: r.titulo }),
    el("p", { class: "detalle-fecha", text: fechaLegible(fechaTS(r.creadoEn)) }),
    r.fotos && r.fotos[0] && el("img", { src: r.fotos[0], alt: "", class: "popup-foto" }),
    r.nota && el("p", { class: "detalle-nota", text: r.nota }),
    r.ubicacion.texto && el("p", { class: "detalle-lugar", text: "📍 " + r.ubicacion.texto }),
    el("a", { href: "#recuerdos", class: "btn-plano", onclick: () => document.querySelector(".modal-fondo")?.remove() }, "Ver en Recuerdos")
  );
  abrirModal(cont);
}
