// Punto de entrada: identidad, navegación por pestañas y estado compartido
// (planes y recuerdos) que se mantiene sincronizado en vivo con Firestore.

import { PERSONAS } from "./config.js";
import { isConfigured, subscribePlanes, subscribeRecuerdos } from "./firebase.js";
import { resolverDesdeURL, guardarPersona, otra } from "./identidad.js";
import { el, limpiar, fechaTS, fechaLegible, cuentaAtras } from "./ui.js";
import { renderLista } from "./vista-lista.js";
import { renderRecuerdos } from "./vista-recuerdos.js";
import { renderMapa } from "./vista-mapa.js";

// ---- Estado global (mini "store") -----------------------------------

export const store = {
  persona: null,
  planes: [],
  recuerdos: [],
  cargando: true,
  _subs: new Set(),
  set(patch) {
    Object.assign(this, patch);
    this._subs.forEach((f) => f());
  },
  onChange(f) {
    this._subs.add(f);
    return () => this._subs.delete(f);
  },
};

export const compañera = () => otra(store.persona.id);

// ---- Arranque ------------------------------------------------------

const app = document.getElementById("app");

if (!isConfigured()) {
  pantallaConfig();
} else {
  const persona = resolverDesdeURL();
  if (persona) iniciar(persona);
  else pantallaQuienEres();
}

function iniciar(persona) {
  store.set({ persona });
  montarShell();
  subscribePlanes((planes) => store.set({ planes, cargando: false }));
  subscribeRecuerdos((recuerdos) => store.set({ recuerdos }));
  window.addEventListener("hashchange", router);
  router();
}

// ---- Pantalla "¿Quién eres?" ------------------------------------

function pantallaQuienEres() {
  limpiar(app);
  const tarjeta = el("div", { class: "portada" },
    el("div", { class: "logo-grande", text: "🌱" }),
    el("h1", { text: "Nuestra lista" }),
    el("p", { class: "sub", text: "Planes y recuerdos, solo para los dos." }),
    el("p", { class: "pregunta", text: "¿Quién eres?" }),
    el("div", { class: "botones-persona" },
      ...Object.values(PERSONAS).map((p) =>
        el("button", {
          class: "btn-persona",
          style: `--c:${p.color}`,
          onclick: () => { guardarPersona(p.id); location.reload(); },
        }, p.nombre)
      )
    ),
    el("p", { class: "nota-pie", text: "Se recuerda en este móvil. Podrás cambiarlo luego." })
  );
  app.append(tarjeta);
}

function pantallaConfig() {
  limpiar(app);
  app.append(el("div", { class: "portada" },
    el("div", { class: "logo-grande", text: "🔧" }),
    el("h1", { text: "Falta configurar Firebase" }),
    el("p", { class: "sub", html:
      'Edita <code>js/config.js</code> con las claves de tu proyecto de Firebase. ' +
      'Tienes los pasos en el <code>README.md</code>.' }),
  ));
}

// ---- Shell con pestañas -----------------------------------------

const TABS = [
  { hash: "#home", icono: "🏠", texto: "Inicio" },
  { hash: "#lista", icono: "📝", texto: "Lista" },
  { hash: "#recuerdos", icono: "📸", texto: "Recuerdos" },
  { hash: "#mapa", icono: "🗺️", texto: "Mapa" },
];

let vista;

function montarShell() {
  limpiar(app);
  const header = el("header", { class: "topbar" },
    el("span", { class: "marca", text: "Nuestra lista" }),
    el("button", {
      class: "chip-persona",
      title: "Cambiar de persona",
      onclick: cambiarPersona,
    }, store.persona.nombre)
  );
  vista = el("main", { class: "vista", id: "vista" });
  const nav = el("nav", { class: "tabbar" },
    ...TABS.map((t) =>
      el("a", { href: t.hash, class: "tab", "data-hash": t.hash },
        el("span", { class: "tab-icono", text: t.icono }),
        el("span", { class: "tab-texto", text: t.texto })
      )
    )
  );
  app.append(header, vista, nav);
}

function cambiarPersona() {
  const nuevo = compañera();
  if (!nuevo) return;
  guardarPersona(nuevo.id);
  location.reload();
}

// ---- Router -----------------------------------------------------

function router() {
  const hash = location.hash || "#home";
  document.querySelectorAll(".tab").forEach((a) =>
    a.classList.toggle("activa", a.dataset.hash === hash)
  );
  // Contenedor nuevo por navegación: al vaciar `vista` el anterior se
  // desconecta y sus suscripciones al store se cancelan (ver observarSalida).
  limpiar(vista);
  window.scrollTo(0, 0);
  const cont = el("div", { class: "vista-inner" });
  vista.append(cont);

  if (hash === "#lista") renderLista(cont);
  else if (hash === "#recuerdos") renderRecuerdos(cont);
  else if (hash === "#mapa") renderMapa(cont);
  else renderHome(cont);
}

// ---- Vista Inicio ---------------------------------------------

function renderHome(cont) {
  const pintar = () => {
    limpiar(cont);
    const pendientes = store.planes.filter((p) => p.estado === "pendiente");
    const hechos = store.planes.filter((p) => p.estado === "hecho");

    // Resumen / contadores
    cont.append(
      el("section", { class: "saludo" },
        el("h2", { text: `Hola, ${store.persona.nombre.split(" ")[0]}` }),
        el("p", { class: "sub", text: store.cargando ? "Cargando…" : frase(pendientes.length, hechos.length) })
      ),
      el("div", { class: "contadores" },
        contador(pendientes.length, "por hacer"),
        contador(hechos.length, "hechos"),
        contador(store.recuerdos.length, "recuerdos")
      )
    );

    // Próximos planes con fecha
    const proximos = pendientes
      .filter((p) => p.fechaObjetivo)
      .sort((a, b) => a.fechaObjetivo.localeCompare(b.fechaObjetivo))
      .slice(0, 3);
    if (proximos.length) {
      cont.append(
        el("section", { class: "bloque" },
          el("div", { class: "bloque-cab" },
            el("h3", { text: "Próximos" }),
            el("a", { href: "#lista", class: "ver-todo", text: "Ver lista" })
          ),
          ...proximos.map((p) => {
            const ca = cuentaAtras(p.fechaObjetivo);
            return el("a", { href: "#lista", class: "fila-mini" },
              el("span", { class: "fila-mini-tit", text: p.titulo }),
              ca && el("span", { class: `badge ${ca.clase}`, text: ca.texto })
            );
          })
        )
      );
    }

    // Último recuerdo
    const ultimo = store.recuerdos[0];
    if (ultimo) {
      cont.append(
        el("section", { class: "bloque" },
          el("div", { class: "bloque-cab" },
            el("h3", { text: "Último recuerdo" }),
            el("a", { href: "#recuerdos", class: "ver-todo", text: "Ver todos" })
          ),
          el("a", { href: "#recuerdos", class: "tarjeta-recuerdo-mini" },
            ultimo.fotos && ultimo.fotos[0]
              ? el("img", { src: ultimo.fotos[0], alt: "", loading: "lazy" })
              : el("div", { class: "sin-foto-mini", text: "📸" }),
            el("div", { class: "tarjeta-recuerdo-mini-txt" },
              el("strong", { text: ultimo.titulo }),
              el("span", { text: fechaLegible(fechaTS(ultimo.creadoEn)) })
            )
          )
        )
      );
    }

    if (!store.cargando && !store.planes.length) {
      cont.append(
        el("section", { class: "vacio" },
          el("p", { text: "Aún no hay ningún plan." }),
          el("a", { href: "#lista", class: "btn-primario", text: "Añadir el primero" })
        )
      );
    }
  };

  pintar();
  const off = store.onChange(pintar);
  observarSalida(cont, off);
}

function frase(pend, hechos) {
  if (!pend && !hechos) return "Empezad vuestra lista de planes juntos.";
  if (!pend) return "¡Lo tenéis todo hecho! Toca soñar algo nuevo.";
  return `${pend} ${pend === 1 ? "plan pendiente" : "planes pendientes"} · ${hechos} ${hechos === 1 ? "cumplido" : "cumplidos"}`;
}

function contador(n, etiqueta) {
  return el("div", { class: "contador" },
    el("span", { class: "contador-n", text: String(n) }),
    el("span", { class: "contador-et", text: etiqueta })
  );
}

// Deja de escuchar el store cuando la vista se reemplaza.
function observarSalida(cont, off) {
  const obs = new MutationObserver(() => {
    if (!cont.isConnected) {
      off();
      obs.disconnect();
    }
  });
  obs.observe(document.getElementById("vista"), { childList: true });
}

export { observarSalida };
