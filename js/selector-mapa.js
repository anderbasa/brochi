// Elegir un sitio a mano, como "Soltar un pin" en Mapas de iOS: el pin se
// queda quieto en el centro y lo que se mueve es el mapa. Al arrastrar, el
// pin se levanta; al parar, cae con un pequeno rebote y debajo aparece el
// nombre del sitio. Tambien se puede buscar por nombre, tocar un punto para
// ir alli o saltar a "Mi ubicacion".
//
// Es una capa a pantalla completa por encima de la hoja del formulario, no
// otra hoja: asi el formulario no se pierde mientras se elige el sitio.

import { el, vibrar } from "./ui.js";
import { store } from "./app.js";
import {
  capaTeselas,
  CENTRO_INICIAL,
  ZOOM_INICIAL,
  buscarSitios,
  nombreDelSitio,
  miniMapa,
  PIN_SVG,
} from "./mapa-comun.js";

const ICONO_FLECHA =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 3.7 3.9 10.4a.6.6 0 0 0 .1 1.1l6.6 1.9 1.9 6.6a.6.6 0 0 0 1.1.1l6.7-16.4z"/></svg>';

const redondear = (c) => ({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });

// Devuelve una promesa con { lat, lng, texto } o null si se cancela.
export function elegirUbicacion({ inicial = null, titulo = "Elegir sitio" } = {}) {
  return new Promise((resolver) => {
    let nombre = "";        // nombre del sitio bajo el pin
    let fijado = null;      // sitio elegido en la busqueda: manda su nombre
    let pedirNombre = null; // AbortController de la peticion en curso
    let tNombre;

    const direccion = el("p", { class: "sm-direccion", text: "Mueve el mapa hasta el sitio" });
    const detalle = el("p", { class: "sm-detalle", text: "o toca un punto, o búscalo arriba" });
    const caja = el("div", { class: "sm-mapa" });
    const buscador = el("input", {
      type: "search",
      placeholder: "Buscar un sitio",
      enterkeyhint: "search",
      autocomplete: "off",
      "aria-label": "Buscar un sitio",
    });
    const resultados = el("div", { class: "sm-resultados" });
    const formBusca = el("form", { class: "sm-busca", role: "search" }, buscador);
    const btnYo = el("button", { type: "button", class: "sm-yo", "aria-label": "Ir a mi ubicación", html: ICONO_FLECHA });
    const btnListo = el("button", { type: "button", class: "btn-primario sm-listo" }, "Poner aquí");

    const capa = el("div", { class: "sm", role: "dialog", "aria-modal": "true", "aria-label": titulo },
      caja,
      el("div", { class: "sm-centro", "aria-hidden": "true" },
        el("div", { class: "sm-sombra" }),
        el("div", { class: "sm-pin", html: PIN_SVG })
      ),
      el("div", { class: "sm-arriba" },
        el("div", { class: "sm-nav" },
          el("button", { type: "button", class: "sm-cancelar", onclick: () => cerrar(null) }, "Cancelar"),
          el("strong", { text: titulo }),
          el("span")
        ),
        formBusca,
        resultados
      ),
      btnYo,
      el("div", { class: "sm-abajo" }, direccion, detalle, btnListo)
    );
    document.body.append(capa);

    // Punto de partida: el sitio que ya tenia, o el ultimo recuerdo con
    // sitio (lo normal es que el nuevo este cerca), o Euskal Herria.
    const ultimo = store.recuerdos.find((r) => r.ubicacion?.lat != null);
    const mapa = L.map(caja, { zoomControl: false, attributionControl: true });
    capaTeselas().addTo(mapa);
    if (inicial?.lat != null) mapa.setView([inicial.lat, inicial.lng], 16);
    else if (ultimo) mapa.setView([ultimo.ubicacion.lat, ultimo.ubicacion.lng], 12);
    else mapa.setView(CENTRO_INICIAL, ZOOM_INICIAL);

    capa.getBoundingClientRect();
    capa.classList.add("visible");
    setTimeout(() => mapa.invalidateSize(), 480);

    // ---- el pin se levanta al mover y cae al parar ----
    mapa.on("movestart", () => {
      capa.classList.add("moviendo");
      clearTimeout(tNombre);
      pedirNombre?.abort();
    });
    mapa.on("moveend", () => {
      capa.classList.remove("moviendo");
      ponerNombre();
    });
    // tocar un punto lleva el pin hasta alli
    mapa.on("click", (e) => mapa.panTo(e.latlng));

    function ponerNombre() {
      const c = mapa.getCenter();
      if (fijado && mapa.distance(c, [fijado.lat, fijado.lng]) < 40) {
        nombre = fijado.nombre;
        direccion.textContent = nombre;
        detalle.textContent = "Resultado de la búsqueda";
        return;
      }
      fijado = null;
      direccion.textContent = "Buscando el nombre del sitio…";
      detalle.textContent = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
      // espera a que el mapa este quieto un momento (y no satura Nominatim)
      tNombre = setTimeout(async () => {
        pedirNombre = new AbortController();
        try {
          nombre = await nombreDelSitio(c.lat.toFixed(6), c.lng.toFixed(6), pedirNombre.signal);
          direccion.textContent = nombre || "Sitio sin nombre";
        } catch (err) {
          if (err.name === "AbortError") return;
          nombre = "";
          direccion.textContent = "Aquí";
        }
      }, 650);
    }
    if (inicial?.lat != null) ponerNombre();

    // ---- buscar por nombre ----
    let pedirBusqueda = null;
    formBusca.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = buscador.value.trim();
      if (!q) return;
      buscador.blur(); // baja el teclado del iPhone
      pedirBusqueda?.abort();
      pedirBusqueda = new AbortController();
      resultados.replaceChildren(el("p", { class: "sm-res-vacio", text: "Buscando…" }));
      capa.classList.add("con-resultados");
      try {
        const lista = await buscarSitios(q, pedirBusqueda.signal);
        if (!lista.length) {
          resultados.replaceChildren(el("p", { class: "sm-res-vacio", text: "No se ha encontrado nada. Prueba con el pueblo o la ciudad." }));
          return;
        }
        resultados.replaceChildren(...lista.map((s) =>
          el("button", {
            type: "button",
            class: "sm-res",
            onclick: () => {
              fijado = s;
              cerrarResultados();
              mapa.flyTo([s.lat, s.lng], 16, { duration: 0.9 });
            },
          },
            el("strong", { text: s.nombre }),
            el("span", { text: s.detalle })
          )
        ));
      } catch (err) {
        if (err.name !== "AbortError") {
          resultados.replaceChildren(el("p", { class: "sm-res-vacio", text: "No se pudo buscar. ¿Hay conexión?" }));
        }
      }
    });
    buscador.addEventListener("input", () => { if (!buscador.value) cerrarResultados(); });
    function cerrarResultados() {
      capa.classList.remove("con-resultados");
      resultados.replaceChildren();
    }

    // ---- mi ubicacion ----
    btnYo.addEventListener("click", () => {
      if (!navigator.geolocation) return;
      btnYo.classList.add("buscando");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btnYo.classList.remove("buscando");
          fijado = null;
          mapa.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 0.9 });
        },
        () => {
          btnYo.classList.remove("buscando");
          direccion.textContent = "No se pudo saber dónde estás";
          detalle.textContent = "Revisa el permiso de ubicación de Safari";
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    btnListo.addEventListener("click", () => {
      vibrar();
      cerrar({ ...redondear(mapa.getCenter()), texto: nombre });
    });

    // Escape (ordenador). En captura y parando: si no, tambien cerraria la
    // hoja del formulario que hay debajo.
    const teclas = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cerrar(null);
    };
    window.addEventListener("keydown", teclas, true);

    let cerrado = false;
    function cerrar(valor) {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(tNombre);
      pedirNombre?.abort();
      pedirBusqueda?.abort();
      window.removeEventListener("keydown", teclas, true);
      capa.classList.remove("visible");
      setTimeout(() => { mapa.remove(); capa.remove(); }, 460);
      resolver(valor);
    }
  });
}

// ---- Campo "Ubicacion en el mapa" de los formularios ----
//
// Va en un <div>, NUNCA dentro de un <label>: en iPhone, cualquier toque
// dentro de un <label> "pulsa" el primer boton que haya dentro. Eso es lo
// que rompio el primer intento de elegir sitio: tocar el mapa acababa
// pidiendo la ubicacion actual.
export function campoUbicacion({ inicial = null, lugar = null } = {}) {
  let coords = inicial?.lat != null ? { lat: inicial.lat, lng: inicial.lng } : null;

  const vista = el("div", { class: "geo-vista" });
  const estado = el("p", { class: "geo-estado" });
  const btnYo = el("button", { type: "button", class: "btn-foto" }, "📍 Estoy aquí");
  const btnMapa = el("button", { type: "button", class: "btn-foto" }, "🗺️ Elegir en el mapa");

  const rellenarLugar = (texto) => {
    if (lugar && !lugar.value.trim() && texto) lugar.value = texto;
  };

  async function abrirSelector() {
    const elegido = await elegirUbicacion({ inicial: coords });
    if (!elegido) return;
    coords = { lat: elegido.lat, lng: elegido.lng };
    rellenarLugar(elegido.texto);
    pintar("Sitio puesto en el mapa ✓");
  }
  btnMapa.addEventListener("click", abrirSelector);

  btnYo.addEventListener("click", () => {
    if (!navigator.geolocation) return pintar("Este móvil no da la ubicación");
    btnYo.disabled = true;
    estado.textContent = "Buscando dónde estás…";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        btnYo.disabled = false;
        coords = redondear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        pintar("Ubicación añadida ✓");
        try { rellenarLugar(await nombreDelSitio(coords.lat, coords.lng)); } catch (_) {}
      },
      (err) => {
        btnYo.disabled = false;
        pintar(err.code === 1 ? "Permiso de ubicación denegado" : "No se pudo saber dónde estás");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  function pintar(mensaje) {
    vista.replaceChildren();
    if (coords) {
      const mini = miniMapa(coords.lat, coords.lng);
      mini.append(el("div", { class: "mini-mapa-pin", html: PIN_SVG }));
      vista.append(
        el("button", { type: "button", class: "geo-vista-btn", "aria-label": "Cambiar el sitio en el mapa", onclick: abrirSelector }, mini),
        el("button", { type: "button", class: "geo-quitar", onclick: () => { coords = null; pintar("Sitio quitado"); } }, "Quitar del mapa")
      );
    }
    estado.textContent = mensaje || (coords ? "Toca el mapa para cambiar el sitio" : "");
  }
  pintar();

  return {
    nodo: el("div", { class: "campo" },
      el("span", { class: "campo-et", text: "Ubicación en el mapa (opcional)" }),
      vista,
      el("div", { class: "geo-botones" }, btnYo, btnMapa),
      estado
    ),
    valor: () => coords,
  };
}
