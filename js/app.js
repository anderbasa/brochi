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
  contarHasta,
} from "./ui.js";
import { renderLista } from "./vista-lista.js";
import { renderRecuerdos, abrirRecuerdo } from "./vista-recuerdos.js";
import { renderMapa } from "./vista-mapa.js";
import { avisarCambios, recordarReacciones } from "./avisos.js";
import { abrirResumenAnual, aniosConDatos } from "./resumen-anual.js";

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
  const acciones = { irALista: () => (location.hash = "#lista"), abrirRecuerdo };
  subscribePlanes((planes, cambios) => {
    if (store.cargando) marcarEntrada();
    store.set({ planes, cargando: false });
    quitarArranque();
    avisarCambios("planes", cambios, persona.id, acciones);
  });
  subscribeRecuerdos((recuerdos, cambios) => {
    avisarCambios("recuerdos", cambios, persona.id, acciones); // antes de recordar: compara con lo anterior
    recordarReacciones(recuerdos);
    store.set({ recuerdos });
  });
  window.addEventListener("hashchange", router);
  router();
  setTimeout(quitarArranque, 2500); // por si no hay red: no dejar la capa puesta
}

// ---- Arranque ---------------------------------------------------
// La capa #arranque (index.html) es una copia de la pantalla de carga de
// iOS: se queda al menos lo que dura el "latido" del monograma y se aparta
// con un zoom suave en cuanto hay datos.
let arranqueQuitado = false;
function quitarArranque() {
  if (arranqueQuitado) return;
  arranqueQuitado = true;
  const capa = document.getElementById("arranque");
  if (!capa) return;
  const espera = Math.max(0, 1050 - performance.now());
  setTimeout(() => {
    capa.classList.add("saliendo");
    if (vista) router();
    setTimeout(() => capa.remove(), 500);
  }, espera);
}

// ---- Pantalla "¿Quién eres?" ------------------------------------

function pantallaQuienEres() {
  limpiar(app);
  const tarjeta = el("div", { class: "portada-marca" },
    el("div", { class: "portada" },
      el("img", { class: "logo-portada", src: "icons/icon-512.png", alt: "" }),
      el("h1", { text: "Nuestra lista" }),
      el("p", { class: "sub", text: "Planes y recuerdos, solo para los dos." }),
      el("p", { class: "pregunta", text: "¿Quién eres?" }),
      el("div", { class: "botones-persona" },
        ...Object.values(PERSONAS).map((p) =>
          el("button", {
            class: "btn-persona",
            style: `--c:${p.color}`,
            onclick: () => {
              vibrar();
              guardarPersona(p.id);
              iniciar(p);
            },
          }, p.nombre)
        )
      ),
      el("p", { class: "nota-pie", text: "Se recuerda en este móvil. Podrás cambiarlo luego." })
    )
  );
  app.append(tarjeta);
  quitarArranque();
}

function pantallaConfig() {
  quitarArranque();
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

// Iconos de linea al estilo de iOS: .i-forma se rellena en la pestaña
// activa y .i-det (los detalles) pasa al color del fondo de la barra, como
// los SF Symbols en version "fill".
const svg = (cuerpo) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${cuerpo}</svg>`;
const TABS = [
  {
    hash: "#home", texto: "Inicio",
    icono: svg('<path class="i-forma" d="M4 10.3 12 3.7l8 6.6V19a1.6 1.6 0 0 1-1.6 1.6H15v-5.2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5.2H5.6A1.6 1.6 0 0 1 4 19z"/>'),
  },
  {
    hash: "#lista", texto: "Lista",
    icono: svg('<rect class="i-forma" x="4.6" y="3.4" width="14.8" height="17.2" rx="3.4"/><path class="i-det" d="M8 9.4l1.4 1.4 2.5-2.7M8 15.1l1.4 1.4 2.5-2.7M14.2 9.6h2M14.2 15.3h2"/>'),
  },
  {
    hash: "#recuerdos", texto: "Recuerdos",
    icono: svg('<rect class="i-forma" x="3.4" y="5" width="17.2" height="14" rx="3.2"/><path class="i-det" d="M3.8 16.6l4.4-4.3a1.2 1.2 0 0 1 1.7 0l3.6 3.6M12.9 15l1.6-1.6a1.2 1.2 0 0 1 1.7 0l3.9 3.8"/><circle class="i-det i-punto" cx="15.6" cy="9.4" r="1.4"/>'),
  },
  {
    hash: "#mapa", texto: "Mapa",
    icono: svg('<path class="i-forma" d="M9 4.5 4 6.3a1 1 0 0 0-.6.9v12a.7.7 0 0 0 .9.7L9 18.2l6 2.2 5-1.8a1 1 0 0 0 .6-.9v-12a.7.7 0 0 0-.9-.7L15 6.7z"/><path class="i-det" d="M9 4.5v13.7M15 6.7v13.7"/>'),
  },
];

let vista;

function montarShell() {
  limpiar(app);
  const header = el("header", { class: "topbar" },
    el("a", { href: "#home", class: "marca", style: "color:inherit;text-decoration:none" },
      el("img", { src: "icons/icon-192.png", alt: "" }),
      "Nuestra lista"
    ),
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
        el("span", { class: "tab-icono", html: t.icono }),
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

let hashAnterior = null;

function router() {
  const hash = location.hash || "#home";
  const pintarVista = () => {
    document.querySelectorAll(".tab").forEach((a) =>
      a.classList.toggle("activa", a.dataset.hash === hash)
    );
    // Contenedor nuevo por navegación: al vaciar `vista` el anterior se
    // desconecta y sus suscripciones al store se cancelan (ver observarSalida).
    limpiar(vista);
    window.scrollTo(0, 0);
    marcarEntrada();
    const cont = el("div", { class: "vista-inner" });
    vista.append(cont);

    if (hash === "#lista") renderLista(cont);
    else if (hash === "#recuerdos") renderRecuerdos(cont);
    else if (hash === "#mapa") renderMapa(cont);
    else renderHome(cont);
  };

  // Al cambiar de pestaña, la vista vieja se funde con la nueva con un
  // pequeño desplazamiento hacia el lado de la pestaña (View Transitions,
  // Safari 18+). Las barras de arriba y abajo se quedan quietas.
  const anterior = hashAnterior;
  hashAnterior = hash;
  if (anterior !== null && anterior !== hash && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const orden = (h) => TABS.findIndex((t) => t.hash === h);
    document.documentElement.dataset.dir = orden(hash) >= orden(anterior) ? "adelante" : "atras";
    document.startViewTransition(pintarVista);
  } else pintarVista();
}

// Durante un momento tras cambiar de vista, las tarjetas entran en cascada
// (ver ".entrando" en el CSS). Fuera de ese momento, repintar por un cambio
// en directo no vuelve a animar todo.
let tEntrando;
function marcarEntrada() {
  const raiz = document.documentElement;
  raiz.classList.add("entrando");
  clearTimeout(tEntrando);
  tEntrando = setTimeout(() => raiz.classList.remove("entrando"), 750);
}
const entrando = () => document.documentElement.classList.contains("entrando");

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
    if (entrando()) cont.querySelectorAll(".contador-n").forEach((n) => contarHasta(n, +n.textContent));

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
      const hero = heroCuenta(proximos[0]);
      cont.append(hero);
      const n = hero.querySelector(".hero-cuenta-numero");
      if (entrando() && /^\d+$/.test(n.textContent)) contarHasta(n, +n.textContent, 1100);
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

    // "Nuestro año": el resumen en historias del año más reciente con datos
    const anios = aniosConDatos();
    if (anios.length) {
      const anio = anios[0];
      cont.append(
        el("button", { type: "button", class: "tarjeta-anio", onclick: () => abrirResumenAnual(anio) },
          el("span", { class: "tarjeta-anio-txt" },
            el("span", { class: "tarjeta-anio-et", text: "✨ Vuestro resumen" }),
            el("strong", { text: `Nuestro ${anio}` }),
            el("span", { text: "Vuestro año, en historias →" })
          ),
          el("img", { src: "icons/monograma.png", alt: "" })
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
