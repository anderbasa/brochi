// Punto de entrada: identidad, navegación por pestañas y estado compartido
// (planes y recuerdos) que se mantiene sincronizado en vivo con Firestore.

import { PERSONAS, CATEGORIAS, FECHA_INICIO } from "./config.js";
import { isConfigured, firebaseListo, supabaseListo, subscribePlanes, subscribeRecuerdos } from "./firebase.js";
import { resolverDesdeURL, guardarPersona, otra } from "./identidad.js";
import {
  el,
  limpiar,
  abrirModal,
  cerrarModal,
  vibrar,
  skeleton,
  fechaTS,
  fechaLegible,
  cuentaAtras,
  diasDesde,
  diasHasta,
} from "./ui.js";
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

const app = document.getElementById("app");

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
  const faltaFirebase = !firebaseListo();
  const faltaSupabase = !supabaseListo();
  let mensaje;
  if (faltaFirebase && faltaSupabase) {
    mensaje = 'Faltan las claves de <strong>Firebase</strong> y de <strong>Supabase</strong> en <code>js/config.js</code>.';
  } else if (faltaFirebase) {
    mensaje = 'Falta la parte de <strong>Firebase</strong> en <code>js/config.js</code> (planes y recuerdos).';
  } else {
    mensaje = 'Firebase ya está listo ✓ — falta la parte de <strong>Supabase</strong> en <code>js/config.js</code> (para las fotos).';
  }
  app.append(el("div", { class: "portada" },
    el("div", { class: "logo-grande", text: "🔧" }),
    el("h1", { text: "Falta terminar de configurar" }),
    el("p", { class: "sub", html: mensaje }),
    el("p", { class: "sub", html: 'Tienes los pasos en el <code>README.md</code>.' }),
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

    // Contador de aniversario — no depende de Firestore, sale siempre.
    const dias = diasDesde(FECHA_INICIO);
    cont.append(
      el("section", { class: "saludo" },
        el("h2", { text: `Hola, ${store.persona.nombre.split(" ")[0]}` }),
        dias != null && el("p", { class: "juntos", text: `💛 ${dias.toLocaleString("es")} días juntos` }),
        el("p", { class: "sub", text: store.cargando ? "Cargando…" : frase(pendientesN(), hechosN()) })
      )
    );

    if (store.cargando) {
      cont.append(skeleton(3));
      return;
    }

    const pendientes = store.planes.filter((p) => p.estado === "pendiente");
    const hechos = store.planes.filter((p) => p.estado === "hecho");

    cont.append(
      el("div", { class: "contadores" },
        contador(pendientes.length, "por hacer"),
        contador(hechos.length, "hechos"),
        contador(store.recuerdos.length, "recuerdos")
      )
    );

    // "Un día como hoy" — recuerdos de la misma fecha en años anteriores.
    const memoria = unDiaComoHoy();
    if (memoria) {
      const años = new Date().getFullYear() - fechaTS(memoria.creadoEn).getFullYear();
      cont.append(
        el("a", { href: "#recuerdos", class: "bloque bloque-memoria" },
          el("div", { class: "bloque-cab" },
            el("h3", { text: `📅 Un día como hoy, hace ${años} ${años === 1 ? "año" : "años"}` })
          ),
          el("div", { class: "tarjeta-recuerdo-mini" },
            memoria.fotos && memoria.fotos[0]
              ? el("img", { src: memoria.fotos[0], alt: "", loading: "lazy" })
              : el("div", { class: "sin-foto-mini", text: "📸" }),
            el("div", { class: "tarjeta-recuerdo-mini-txt" },
              el("strong", { text: memoria.titulo }),
              memoria.nota && el("span", { text: memoria.nota })
            )
          )
        )
      );
    }

    // Próximo plan con fecha, destacado en grande — y el resto, en lista.
    const proximos = pendientes
      .filter((p) => p.fechaObjetivo)
      .sort((a, b) => a.fechaObjetivo.localeCompare(b.fechaObjetivo));
    if (proximos.length) {
      cont.append(heroCuenta(proximos[0]));
      const resto = proximos.slice(1, 4);
      if (resto.length) {
        cont.append(
          el("section", { class: "bloque" },
            el("div", { class: "bloque-cab" },
              el("h3", { text: "También pronto" }),
              el("a", { href: "#lista", class: "ver-todo", text: "Ver lista" })
            ),
            ...resto.map((p) => {
              const ca = cuentaAtras(p.fechaObjetivo);
              return el("a", { href: "#lista", class: "fila-mini" },
                el("span", { class: "fila-mini-tit", text: p.titulo }),
                ca && el("span", { class: `badge ${ca.clase}`, text: ca.texto })
              );
            })
          )
        );
      }
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

    if (!store.planes.length) {
      cont.append(
        el("section", { class: "vacio" },
          el("p", { text: "Aún no hay ningún plan." }),
          el("a", { href: "#lista", class: "btn-primario", text: "Añadir el primero" })
        )
      );
    } else {
      const acciones = el("div", { class: "acciones-home" });
      if (pendientes.length) {
        acciones.append(el("button", { class: "btn-sorpresa", type: "button", onclick: sorprenderme }, "🎲 Sorpréndeme"));
      }
      if (store.recuerdos.length) {
        acciones.append(el("button", { class: "btn-sorpresa", type: "button", onclick: recuerdoAlAzar }, "🎞️ Recuerdo al azar"));
      }
      if (hechos.length || store.recuerdos.length) {
        acciones.append(el("button", { class: "btn-sorpresa", type: "button", onclick: verResumen }, "📊 Resumen"));
      }
      if (acciones.childNodes.length) cont.append(acciones);
    }
  };

  const pendientesN = () => store.planes.filter((p) => p.estado === "pendiente").length;
  const hechosN = () => store.planes.filter((p) => p.estado === "hecho").length;

  pintar();
  const off = store.onChange(pintar);
  observarSalida(cont, off);
}

// Recuerdo(s) de la misma fecha (día+mes) en un año anterior — el más
// reciente si hay varios. `null` si no hay ninguno.
function unDiaComoHoy() {
  const hoy = new Date();
  const coincidencias = store.recuerdos
    .map((r) => ({ r, f: fechaTS(r.creadoEn) }))
    .filter(
      ({ f }) => f && f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth() && f.getFullYear() !== hoy.getFullYear()
    )
    .sort((a, b) => b.f - a.f);
  return coincidencias[0]?.r || null;
}

// Elige un plan pendiente al azar y lo muestra en una tarjeta — para cuando
// no sabéis qué hacer.
function sorprenderme() {
  const pendientes = store.planes.filter((p) => p.estado === "pendiente");
  if (!pendientes.length) return;
  mostrarSorpresa(pendientes);
}

function mostrarSorpresa(pendientes) {
  vibrar(20);
  const p = pendientes[Math.floor(Math.random() * pendientes.length)];
  const cat = CATEGORIAS.find((c) => c.id === p.categoria);
  const cont = el("div", { class: "sorpresa" },
    el("div", { class: "sorpresa-emoji", text: "🎲" }),
    el("h3", { text: "¿Qué tal...?" }),
    p.fotoRef && el("img", { class: "sorpresa-foto", src: p.fotoRef, alt: "" }),
    el("p", { class: "sorpresa-tit" }, cat ? `${cat.emoji} ` : "", p.titulo),
    p.nota && el("p", { class: "sorpresa-nota", text: p.nota }),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-plano", onclick: () => mostrarSorpresa(pendientes) }, "Otro"),
      el("a", { class: "btn-primario", href: "#lista", onclick: cerrarModal }, "Ver en la lista")
    )
  );
  abrirModal(cont);
}

// ---- Countdown grande del próximo plan --------------------------------

function heroCuenta(plan) {
  const dias = diasHasta(plan.fechaObjetivo);
  const cat = CATEGORIAS.find((c) => c.id === plan.categoria);
  let numero, etiqueta;
  if (dias < 0) {
    numero = "😅";
    etiqueta = `Se pasó hace ${-dias} ${-dias === 1 ? "día" : "días"}`;
  } else if (dias === 0) {
    numero = "🎉";
    etiqueta = "¡Es hoy!";
  } else if (dias === 1) {
    numero = "🙌";
    etiqueta = "¡Es mañana!";
  } else {
    numero = String(dias);
    etiqueta = "días";
  }
  return el("a", { href: "#lista", class: "hero-cuenta" },
    el("span", { class: "hero-cuenta-et", text: "Próximo plan" }),
    el("span", { class: "hero-cuenta-numero", text: numero }),
    el("span", { class: "hero-cuenta-unidad", text: etiqueta }),
    el("span", { class: "hero-cuenta-tit" }, cat ? `${cat.emoji} ` : "", plan.titulo)
  );
}

// ---- Recuerdo al azar ------------------------------------------------

function recuerdoAlAzar() {
  if (!store.recuerdos.length) return;
  mostrarRecuerdoAzar();
}

function mostrarRecuerdoAzar() {
  vibrar(20);
  const r = store.recuerdos[Math.floor(Math.random() * store.recuerdos.length)];
  const cont = el("div", { class: "sorpresa" },
    el("div", { class: "sorpresa-emoji", text: "🎞️" }),
    el("h3", { text: "¿Te acuerdas?" }),
    r.fotos && r.fotos[0]
      ? el("img", { class: "sorpresa-foto", src: r.fotos[0], alt: "" })
      : el("div", { class: "sin-foto-mini", text: "📸" }),
    el("p", { class: "sorpresa-tit", text: r.titulo }),
    el("p", { class: "sorpresa-nota sub", text: fechaLegible(fechaTS(r.creadoEn)) }),
    r.nota && el("p", { class: "sorpresa-nota", text: r.nota }),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-plano", onclick: mostrarRecuerdoAzar }, "Otro"),
      el("a", { class: "btn-primario", href: "#recuerdos", onclick: cerrarModal }, "Ver todos")
    )
  );
  abrirModal(cont);
}

// ---- Resumen del año --------------------------------------------------

function calcularResumen() {
  const hechos = store.planes.filter((p) => p.estado === "hecho");
  const porCategoria = {};
  hechos.forEach((p) => {
    if (p.categoria) porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1;
  });
  const [catTopId, catTopN] =
    Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0] || [];
  const catTop = CATEGORIAS.find((c) => c.id === catTopId);

  const totalFotos = store.recuerdos.reduce((n, r) => n + (r.fotos?.length || 0), 0);
  const sitios = new Set(
    store.recuerdos.map((r) => r.ubicacion?.texto?.trim().toLowerCase()).filter(Boolean)
  );

  const conFecha = store.recuerdos
    .map((r) => ({ r, f: fechaTS(r.creadoEn) }))
    .filter(({ f }) => f)
    .sort((a, b) => a.f - b.f);
  const primero = conFecha[0]?.r || null;

  const masQuerido = store.recuerdos
    .map((r) => ({ r, likes: Object.values(r.reacciones || {}).filter(Boolean).length }))
    .filter(({ likes }) => likes > 0)
    .sort((a, b) => b.likes - a.likes)[0];

  return { totalHechos: hechos.length, catTop, catTopN, totalFotos, sitiosN: sitios.size, primero, masQuerido };
}

function verResumen() {
  const r = calcularResumen();
  const cont = el("div", { class: "resumen" },
    el("h3", { text: "📊 Vuestro resumen" }),
    el("div", { class: "contadores" },
      contador(r.totalHechos, "planes cumplidos"),
      contador(store.recuerdos.length, "recuerdos"),
      contador(r.totalFotos, "fotos")
    ),
    el("ul", { class: "resumen-lista" },
      r.catTop && el("li", { text: `${r.catTop.emoji} Vuestra categoría favorita: ${r.catTop.etiqueta} (${r.catTopN} ${r.catTopN === 1 ? "vez" : "veces"})` }),
      r.sitiosN > 0 && el("li", { text: `📍 ${r.sitiosN} ${r.sitiosN === 1 ? "sitio distinto" : "sitios distintos"} con recuerdos` }),
      r.primero && el("li", { text: `🌱 Vuestro primer recuerdo: ${fechaLegible(fechaTS(r.primero.creadoEn))}` }),
      r.masQuerido && el("li", { text: `❤️ El recuerdo más querido: "${r.masQuerido.r.titulo}" (${r.masQuerido.likes} ❤️)` })
    ),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-primario", onclick: cerrarModal }, "Cerrar")
    )
  );
  abrirModal(cont);
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

// ---- Arranque -----------------------------------------------------
// Va al final a propósito: usa `TABS`, `vista` y las funciones de arriba, y
// en un módulo ES las `const`/`let` no están disponibles hasta que su propia
// línea se ejecuta (aunque las `function` sí están disponibles desde el
// principio). Si este bloque fuera lo primero del archivo, la primerísima
// vez que alguien ya tiene una persona guardada (o entra con ?yo=...) el
// arranque intentaría usar `TABS`/`vista` antes de tiempo y la app se
// quedaría en blanco sin ningún aviso.

if (!isConfigured()) {
  pantallaConfig();
} else {
  const persona = resolverDesdeURL();
  if (persona) iniciar(persona);
  else pantallaQuienEres();
}
