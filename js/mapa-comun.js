// Piezas compartidas por la pestaña Mapa y el selector de sitio:
// - las teselas del mapa: las de OpenStreetMap, gratis y sin clave (CARTO
//   ahora pide clave). El tono calido y el modo oscuro van por CSS, con un
//   filtro sobre las teselas (ver .leaflet-tile-pane en estilo.css)
// - las busquedas de sitios en Nominatim (OpenStreetMap, gratis y sin clave)
// - un mini mapa estatico (sin Leaflet) para las vistas previas

const TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function capaTeselas() {
  return L.tileLayer(TESELAS, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}

// Euskal Herria, para cuando aun no hay ningun sitio guardado
export const CENTRO_INICIAL = [43.05, -2.3];
export const ZOOM_INICIAL = 8;

// ---- Nominatim ----
// Sus normas: nada de autocompletar mientras se escribe (solo al pulsar
// Buscar) y como mucho una peticion por segundo. Aqui se respeta: buscar va
// con el boton y el nombre del sitio espera a que el mapa se pare.

const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function buscarSitios(texto, signal) {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&namedetails=1&limit=6&accept-language=es&q=${encodeURIComponent(texto)}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error("busqueda " + resp.status);
  return (await resp.json()).map((x) => ({
    lat: +x.lat,
    lng: +x.lon,
    nombre: nombreCorto(x),
    detalle: x.display_name,
  }));
}

export async function nombreDelSitio(lat, lng, signal) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&namedetails=1&accept-language=es&lat=${lat}&lon=${lng}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error("sitio " + resp.status);
  const x = await resp.json();
  return x && !x.error ? nombreCorto(x) : "";
}

// "Playa de la Concha, Donostia" en vez de la direccion entera de Nominatim.
// Para el sitio en si se prefiere su nombre oficial (Mundaka, no "Mundaca"),
// salvo que vaya en otro alfabeto (Москва): entonces, el de en castellano.
const LATINO = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u;
function nombreCorto(x) {
  const a = x.address || {};
  const oficial = x.namedetails?.name;
  const pueblo = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || a.state || "";
  const principal = (oficial && LATINO.test(oficial) ? oficial : x.name) || [a.road, a.house_number].filter(Boolean).join(" ") || a.suburb || a.neighbourhood || "";
  const partes = [principal, pueblo].filter((v, i, arr) => v && arr.indexOf(v) === i);
  return partes.join(", ") || (x.display_name || "").split(",").slice(0, 2).join(",").trim();
}

// Distancia en km entre dos puntos (formula del haversine)
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// ---- Mini mapa estatico ----
// 5x3 teselas con el punto justo en el centro. Son <img> sueltas, sin
// Leaflet: no captura toques ni gestos, y pesa muy poco. Para que se vea
// nitido en el iPhone se usan las teselas de un zoom mas, a mitad de tamano.
const T = 128; // px que ocupa cada tesela en pantalla
export function miniMapa(lat, lng, zoom = 15) {
  const z = zoom + 1;
  const n = 2 ** z;
  const px = ((lng + 180) / 360) * n * T;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const py = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n * T;
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  const caja = document.createElement("div");
  caja.className = "mini-mapa";
  const capa = document.createElement("div");
  capa.className = "mini-mapa-teselas";
  // el punto (px, py) tiene que caer en el centro de la caja
  capa.style.transform = `translate(${-(px - (tx - 2) * T)}px, ${-(py - (ty - 1) * T)}px)`;
  for (let j = -1; j <= 1; j++) {
    for (let i = -2; i <= 2; i++) {
      const x = (((tx + i) % n) + n) % n, y = ty + j;
      if (y < 0 || y >= n) continue;
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = TESELAS.replace("{z}", z).replace("{x}", x).replace("{y}", y);
      img.style.left = (i + 2) * T + "px";
      img.style.top = (j + 1) * T + "px";
      capa.append(img);
    }
  }
  caja.append(capa);
  return caja;
}

// El pin de la casa: gota terracota con un corazon (para el selector y la
// vista previa)
export const PIN_SVG = `<svg viewBox="0 0 48 64" aria-hidden="true"><defs><linearGradient id="pin-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dc8a55"/><stop offset="1" stop-color="#a8492a"/></linearGradient></defs><path d="M24 61C16 51 4 37.5 4 24a20 20 0 0 1 40 0c0 13.5-12 27-20 37z" fill="url(#pin-grad)" stroke="#fff" stroke-width="3"/><path d="M24 33.5c-1.2-.9-9-6.4-9-11.8a4.8 4.8 0 0 1 9-2.3 4.8 4.8 0 0 1 9 2.3c0 5.4-7.8 10.9-9 11.8z" fill="#fff"/></svg>`;
