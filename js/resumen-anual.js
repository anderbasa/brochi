// "Nuestro año": el resumen del año en historias a pantalla completa, al
// estilo del Wrapped de Spotify o de las historias de Instagram:
// - toque a la derecha: siguiente; a la izquierda: anterior
// - mantener pulsado: pausa; arrastrar hacia abajo: cerrar
// - cada historia pasa sola a los pocos segundos (menos la ultima)
// - al final se puede compartir una imagen con el resumen
//
// Todo sale de los datos que ya hay en el store: no escribe nada.

import { store } from "./app.js";
import { PERSONAS, CATEGORIAS } from "./config.js";
import { el, aviso, mensajeError, vibrar, fechaTS, fechaLegible, cuentaAtras, contarHasta } from "./ui.js";
import { distanciaKm } from "./mapa-comun.js";
import { cargarLocal } from "./compartir.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DURACION = 6500; // ms por historia

const FONDOS = {
  marca: "var(--marca-fondo)",
  salvia: "linear-gradient(160deg, #7fa878 0%, #4d7a4c 45%, #22402a 100%)",
  rosa: "linear-gradient(160deg, #d6708a 0%, #9c3d62 50%, #4a1733 100%)",
  ambar: "linear-gradient(160deg, #f0b85a 0%, #c9772c 50%, #6e3414 100%)",
  noche: "linear-gradient(160deg, #6a6fc4 0%, #3a3d8a 50%, #15173a 100%)",
  mar: "linear-gradient(160deg, #57aab2 0%, #2c7480 50%, #103740 100%)",
  coral: "linear-gradient(160deg, #f08a6a 0%, #c4513d 50%, #5e1f1c 100%)",
  foto: "#000",
};

const plural = (n, uno, varios) => (n === 1 ? uno : varios);
const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Años con algo que contar (recuerdos o planes cumplidos), el mas reciente primero
export function aniosConDatos() {
  const anios = new Set();
  const apuntar = (ts) => { const d = fechaTS(ts); if (d) anios.add(d.getFullYear()); };
  store.recuerdos.forEach((r) => apuntar(r.creadoEn));
  store.planes.forEach((p) => p.estado === "hecho" && apuntar(p.completadoEn));
  return [...anios].sort((a, b) => b - a);
}

function calcular(anio) {
  const delAnio = (ts) => fechaTS(ts)?.getFullYear() === anio;
  const recuerdos = store.recuerdos.filter((r) => delAnio(r.creadoEn));
  const cumplidos = store.planes.filter((p) => p.estado === "hecho" && delAnio(p.completadoEn));
  const nuevos = store.planes.filter((p) => delAnio(p.creadoEn)).length;
  const fotos = recuerdos.flatMap((r) => r.fotos || []);

  const meses = Array(12).fill(0);
  recuerdos.forEach((r) => meses[fechaTS(r.creadoEn).getMonth()]++);
  const maxMes = Math.max(...meses);

  const porCategoria = {};
  cumplidos.forEach((p) => { if (p.categoria) porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1; });
  const [catId, catN] = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0] || [];

  const sitios = [...new Map(
    recuerdos.filter((r) => r.ubicacion?.texto?.trim()).map((r) => [r.ubicacion.texto.trim().toLowerCase(), r.ubicacion.texto.trim()])
  ).values()];
  const puntos = recuerdos.filter((r) => r.ubicacion?.lat != null).map((r) => r.ubicacion);
  let distMax = 0;
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) distMax = Math.max(distMax, distanciaKm(puntos[i], puntos[j]));
  }

  const likes = (r) => Object.values(r.reacciones || {}).filter(Boolean).length;
  const personas = Object.values(PERSONAS).map((p) => ({
    p,
    guardados: recuerdos.filter((r) => r.creadoPor === p.id).length,
    likes: recuerdos.filter((r) => r.reacciones?.[p.id]).length,
  }));
  const estrella = [...recuerdos].sort((a, b) => likes(b) - likes(a) || (b.fotos?.length || 0) - (a.fotos?.length || 0))[0] || null;

  const pendientes = store.planes.filter((p) => p.estado === "pendiente");
  const h = new Date();
  const hoy = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  const proximo = pendientes
    .filter((p) => p.fechaObjetivo && p.fechaObjetivo >= hoy)
    .sort((a, b) => a.fechaObjetivo.localeCompare(b.fechaObjetivo))[0] || null;

  return {
    anio, recuerdos, cumplidos: cumplidos.length, nuevos, fotos,
    meses, maxMes, mesTop: maxMes > 0 ? meses.indexOf(maxMes) : -1,
    cat: CATEGORIAS.find((c) => c.id === catId), catN,
    sitios, nSitios: sitios.length || puntos.length, distMax,
    personas, estrella, likesEstrella: estrella ? likes(estrella) : 0,
    pendientes: pendientes.length, proximo,
  };
}

// ---- Piezas de las historias ----

// `anim` hace que un elemento entre con muelle tras `retraso` segundos
function anim(nodo, retraso) {
  nodo.classList.add("h-a");
  nodo.style.setProperty("--d", retraso + "s");
  return nodo;
}
const texto = (clase, t, retraso) => anim(el("p", { class: clase, text: t }), retraso);
const numero = (n, retraso) => anim(el("span", { class: "h-num", "data-n": n, text: String(n) }), retraso);

function diapo(fondo, hijos, extra = {}) {
  return {
    ...extra,
    crear: () => el("section", { class: `hd f-${fondo}${extra.centrado ? " centrado" : ""}`, style: `--fondo:${FONDOS[fondo]}` },
      ...(extra.detras ? extra.detras() : []),
      el("div", { class: "h-contenido" }, ...hijos().filter(Boolean)) // fuera los 0/false de los `n && ...`
    ),
  };
}

function crearDiapos(d, anios, acciones) {
  const lista = [];

  // 1. Portada
  lista.push(diapo("marca", () => [
    el("img", { class: "h-mono", src: "icons/monograma.png", alt: "" }),
    texto("h-eti", "Vuestro resumen", 0.35),
    anim(el("h2", { class: "h-titulo", text: `Nuestro ${d.anio}` }), 0.45),
    texto("h-sub", "Un año de planes, sitios y recuerdos juntos.", 0.6),
    anios.length > 1 && anim(el("div", { class: "h-anios" },
      ...anios.map((y) => el("button", { type: "button", class: "h-anio" + (y === d.anio ? " activo" : ""), onclick: () => acciones.cambiarAnio(y) }, String(y)))
    ), 0.75),
    texto("h-pista", "Toca para seguir →", 1.2),
  ], { centrado: true }));

  // 2. Planes
  if (d.cumplidos || d.nuevos) {
    lista.push(diapo("salvia", () => d.cumplidos
      ? [
          texto("h-txt", "Este año habéis cumplido", 0.1),
          numero(d.cumplidos, 0.25),
          texto("h-grande", plural(d.cumplidos, "plan de vuestra lista", "planes de vuestra lista"), 0.4),
          d.nuevos && texto("h-sub", `…y habéis apuntado ${d.nuevos} ${plural(d.nuevos, "plan nuevo", "planes nuevos")} ✍️`, 0.75),
        ]
      : [
          texto("h-txt", "Este año habéis soñado", 0.1),
          numero(d.nuevos, 0.25),
          texto("h-grande", plural(d.nuevos, "plan nuevo", "planes nuevos"), 0.4),
          texto("h-sub", "Lo mejor está por llegar ✨", 0.75),
        ]
    ));
  }

  // 3. Recuerdos y fotos (con polaroids que caen)
  if (d.recuerdos.length) {
    const POS = [[2, 0, -8], [30, 26, 5], [57, 4, -3], [15, 76, 7], [45, 86, -6]];
    lista.push(diapo("rosa", () => [
      texto("h-txt", "Habéis guardado", 0.1),
      numero(d.recuerdos.length, 0.25),
      texto("h-grande", plural(d.recuerdos.length, "recuerdo", "recuerdos"), 0.4),
      d.fotos.length && texto("h-sub", `y ${d.fotos.length} ${plural(d.fotos.length, "foto", "fotos")} para no olvidar nada`, 0.55),
      d.fotos.length && el("div", { class: "h-polaroids" },
        ...d.fotos.slice(0, 5).map((url, i) =>
          el("div", { class: "h-pol", style: `--x:${POS[i][0]}%;--y:${POS[i][1]}px;--g:${POS[i][2]}deg;--d:${0.8 + i * 0.14}s` },
            el("img", { src: url, alt: "" })
          )
        )
      ),
    ]));
  }

  // 4. El mes con mas recuerdos
  if (d.mesTop >= 0) {
    lista.push(diapo("ambar", () => [
      texto("h-txt", "Vuestro mes fue", 0.1),
      anim(el("h2", { class: "h-titulo", text: mayus(MESES[d.mesTop]) }), 0.25),
      texto("h-sub", `${d.maxMes} ${plural(d.maxMes, "recuerdo", "recuerdos")} en ${MESES[d.mesTop]}`, 0.4),
      el("div", { class: "h-barras", "aria-hidden": "true" },
        ...d.meses.map((n, i) => el("div", {
          class: "h-barra" + (i === d.mesTop ? " top" : ""),
          style: `--h:${Math.max(4, (n / d.maxMes) * 100)};--d:${0.5 + i * 0.05}s`,
        }, el("span", { text: MESES[i][0].toUpperCase() })))
      ),
    ]));
  }

  // 5. Categoria favorita
  if (d.cat) {
    lista.push(diapo("noche", () => [
      texto("h-txt", "Lo vuestro es…", 0.1),
      el("span", { class: "h-emoji", style: "--d:.3s", text: d.cat.emoji }),
      anim(el("h2", { class: "h-titulo", text: d.cat.etiqueta }), 0.55),
      texto("h-sub", `${d.catN} ${plural(d.catN, "plan cumplido", "planes cumplidos")} de esta categoría`, 0.7),
    ], { centrado: true }));
  }

  // 6. Sitios
  if (d.nSitios) {
    const chips = d.sitios.slice(0, 8);
    lista.push(diapo("mar", () => [
      texto("h-txt", "Habéis dejado huella en", 0.1),
      numero(d.nSitios, 0.25),
      texto("h-grande", plural(d.nSitios, "sitio", "sitios distintos"), 0.4),
      chips.length && el("div", { class: "h-chips" },
        ...chips.map((s, i) => anim(el("span", { class: "h-chip", text: "📍 " + s }), 0.6 + i * 0.08))
      ),
      d.distMax >= 2 && texto("h-sub", `🧭 ${Math.round(d.distMax).toLocaleString("es")} km entre los dos más lejanos`, 0.75 + chips.length * 0.08),
    ]));
  }

  // 7. Cosas de dos
  if (d.recuerdos.length) {
    const [a, b] = d.personas;
    let frase;
    if (a.likes !== b.likes) frase = `${(a.likes > b.likes ? a : b).p.nombre} ha repartido más ❤️ este año`;
    else if (a.likes > 0) frase = "Empate de ❤️. Así da gusto.";
    else if (a.guardados !== b.guardados) frase = `${(a.guardados > b.guardados ? a : b).p.nombre} ha guardado más recuerdos`;
    else frase = "Todo a medias, como tiene que ser.";
    lista.push(diapo("coral", () => [
      texto("h-txt", "Cosas de dos", 0.1),
      el("div", { class: "h-pareja" },
        ...d.personas.map((x, i) => anim(el("div", { class: "h-persona" },
          el("span", { class: "h-avatar", style: `--c:${x.p.color}`, text: x.p.nombre.charAt(0) }),
          el("strong", { text: x.p.nombre }),
          el("span", { text: `${x.guardados} ${plural(x.guardados, "recuerdo guardado", "recuerdos guardados")}` }),
          el("span", { text: `${x.likes} ❤️ ${plural(x.likes, "dado", "dados")}` })
        ), 0.3 + i * 0.15))
      ),
      texto("h-sub", frase, 0.75),
    ]));
  }

  // 8. El recuerdo del año
  if (d.estrella) {
    const r = d.estrella;
    const foto = r.fotos?.[0];
    lista.push(diapo(foto ? "foto" : "rosa", () => [
      texto("h-eti", "Vuestro recuerdo del año", 0.2),
      anim(el("h2", { class: "h-titulo", text: r.titulo }), 0.35),
      texto("h-sub", [fechaLegible(fechaTS(r.creadoEn)), r.ubicacion?.texto && "📍 " + r.ubicacion.texto].filter(Boolean).join(" · "), 0.5),
      d.likesEstrella >= 2 && texto("h-sub", "❤️ Os encanta a los dos", 0.65),
    ], {
      detras: () => foto ? [el("img", { class: "h-fondo-foto", src: foto, alt: "" }), el("div", { class: "h-velo" })] : [],
    }));
  }

  // 9. Lo que viene + compartir
  lista.push(diapo("marca", () => {
    const ca = d.proximo ? cuentaAtras(d.proximo.fechaObjetivo) : null;
    const btnCompartir = el("button", { type: "button", class: "h-btn", disabled: true }, "Preparando la imagen…");
    acciones.prepararCompartir(btnCompartir);
    return [
      texto("h-txt", "Y lo que queda por venir…", 0.1),
      numero(d.pendientes, 0.25),
      texto("h-grande", plural(d.pendientes, "plan pendiente", "planes pendientes"), 0.4),
      d.proximo && anim(el("div", { class: "h-proximo" },
        el("span", { text: "El próximo" }),
        el("strong", { text: d.proximo.titulo }),
        ca && el("span", { text: ca.texto })
      ), 0.6),
      texto("h-gracias", `Gracias por este ${d.anio} ♥`, 0.85),
      anim(el("div", { class: "h-botones" },
        btnCompartir,
        el("button", { type: "button", class: "h-btn sec", onclick: () => acciones.otraVez() }, "↺ Ver otra vez")
      ), 1),
    ];
  }, { final: true }));

  return lista;
}

// ---- Imagen para compartir (1080x1920, formato historia) ----

async function crearImagen(d) {
  await Promise.all([
    document.fonts.load("italic 600 120px Fraunces"),
    document.fonts.load("600 120px Fraunces"),
    document.fonts.load("italic 500 40px Fraunces"),
    document.fonts.load("800 34px Nunito"),
    document.fonts.load("700 40px Nunito"),
  ]).catch(() => {});
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#d27748"); g.addColorStop(0.6, "#a8492a"); g.addColorStop(1, "#6f2a1b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const luz = ctx.createRadialGradient(W * 0.25, H * 0.12, 0, W * 0.25, H * 0.12, 950);
  luz.addColorStop(0, "rgba(255,200,150,0.45)"); luz.addColorStop(1, "rgba(255,200,150,0)");
  ctx.fillStyle = luz; ctx.fillRect(0, 0, W, H);

  try { ctx.drawImage(await cargarLocal("icons/monograma.png"), W / 2 - 190, 140, 380, 380); } catch (_) {}

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,246,236,0.85)";
  ctx.font = "800 34px Nunito, sans-serif";
  ctx.fillText("V U E S T R O   R E S U M E N", W / 2, 600);
  ctx.fillStyle = "#fff6ec";
  ctx.font = "italic 600 132px Fraunces, Georgia, serif";
  ctx.fillText(`Nuestro ${d.anio}`, W / 2, 745);

  const datos = [
    [d.cumplidos, plural(d.cumplidos, "plan cumplido", "planes cumplidos")],
    [d.recuerdos.length, plural(d.recuerdos.length, "recuerdo", "recuerdos")],
    [d.fotos.length, plural(d.fotos.length, "foto", "fotos")],
    [d.nSitios, plural(d.nSitios, "sitio", "sitios")],
  ];
  const ancho = (W - 180 - 30) / 2, alto = 300;
  datos.forEach(([n, et], i) => {
    const x = 90 + (i % 2) * (ancho + 30), y = 830 + Math.floor(i / 2) * (alto + 30);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, ancho, alto, 44); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff6ec";
    ctx.font = "600 128px Fraunces, Georgia, serif";
    ctx.fillText(String(n), x + ancho / 2, y + 170);
    ctx.fillStyle = "rgba(255,246,236,0.85)";
    ctx.font = "700 38px Nunito, sans-serif";
    ctx.fillText(et, x + ancho / 2, y + 238);
  });

  const lineas = [
    d.mesTop >= 0 && `📅 Vuestro mes: ${mayus(MESES[d.mesTop])}`,
    d.cat && `${d.cat.emoji} Lo vuestro: ${d.cat.etiqueta}`,
    d.distMax >= 2 && `🧭 ${Math.round(d.distMax).toLocaleString("es")} km entre vuestros sitios`,
  ].filter(Boolean);
  ctx.fillStyle = "#fff6ec";
  ctx.font = "700 42px Nunito, sans-serif";
  lineas.forEach((l, i) => ctx.fillText(l, W / 2, 1565 + i * 66));

  ctx.font = "italic 500 40px Fraunces, Georgia, serif";
  ctx.fillStyle = "rgba(255,246,236,0.9)";
  ctx.fillText("A♥N · Nuestra lista", W / 2, H - 100);

  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("imagen"))), "image/jpeg", 0.9));
}

// ---- El reproductor de historias ----

export function abrirResumenAnual(pedido) {
  const anios = aniosConDatos();
  if (!anios.length) {
    aviso("Aún no hay nada que resumir: completad algún plan 💛");
    return;
  }
  let anio = anios.includes(pedido) ? pedido : anios[0];
  let datos, diapos = [], actual = 0, transcurrido = 0, pausado = false, nodoActual = null;
  let imagen = null; // promesa del blob de la imagen para compartir (por año)

  const progreso = el("div", { class: "h-progreso", "aria-hidden": "true" });
  const escena = el("div", { class: "h-escena" });
  const capa = el("div", { class: "historia", role: "dialog", "aria-modal": "true", "aria-label": `Nuestro ${anio}` },
    escena,
    progreso,
    el("button", { type: "button", class: "h-cerrar", "aria-label": "Cerrar", onclick: () => cerrar() }, "✕")
  );

  const acciones = {
    cambiarAnio(y) {
      if (y === anio) return;
      vibrar(10);
      anio = y;
      construir();
      ir(0);
    },
    otraVez() { vibrar(10); ir(0); },
    prepararCompartir(boton) {
      imagen ||= crearImagen(datos);
      const nombre = `nuestro-${datos.anio}.jpg`;
      imagen.then((blob) => {
        const archivo = new File([blob], nombre, { type: "image/jpeg" });
        const conArchivo = !!navigator.canShare?.({ files: [archivo] });
        boton.disabled = false;
        boton.textContent = navigator.share ? "📤 Compartir nuestro año" : "💾 Guardar la imagen";
        boton.onclick = async () => {
          vibrar();
          if (!navigator.share) {
            const a = el("a", { href: URL.createObjectURL(blob), download: nombre });
            a.click();
            return;
          }
          try {
            if (conArchivo) await navigator.share({ files: [archivo], title: `Nuestro ${datos.anio}` });
            else await navigator.share({ title: `Nuestro ${datos.anio}`, text: `Nuestro ${datos.anio}: ${datos.cumplidos} planes cumplidos y ${datos.recuerdos.length} recuerdos 💛` });
          } catch (err) {
            if (err && err.name !== "AbortError") aviso(mensajeError(err, "No se pudo compartir"), "error");
          }
        };
      }).catch((err) => {
        console.error(err);
        boton.textContent = "No se pudo preparar la imagen";
      });
    },
  };

  function construir() {
    datos = calcular(anio);
    imagen = null;
    diapos = crearDiapos(datos, anios, acciones);
    capa.setAttribute("aria-label", `Nuestro ${anio}`);
    progreso.replaceChildren(...diapos.map(() => el("span", {}, el("i"))));
  }

  function ir(i) {
    if (i >= diapos.length) return cerrar();
    actual = Math.max(0, i);
    transcurrido = 0;
    const nodo = diapos[actual].crear();
    escena.append(nodo);
    const anterior = nodoActual;
    nodoActual = nodo;
    nodo.getBoundingClientRect();
    nodo.classList.add("visible");
    if (anterior) setTimeout(() => anterior.remove(), 500);
    nodo.querySelectorAll("[data-n]").forEach((n) => contarHasta(n, +n.dataset.n, 1300));
    pintarProgreso();
  }

  function pintarProgreso() {
    [...progreso.children].forEach((b, i) => {
      const k = i < actual ? 1 : i > actual ? 0 : diapos[actual].final ? 1 : Math.min(1, transcurrido / DURACION);
      b.firstChild.style.transform = `scaleX(${k})`;
    });
  }

  let raf = 0, ultimo = performance.now();
  function bucle(t) {
    const dt = Math.min(100, t - ultimo);
    ultimo = t;
    if (!pausado && !document.hidden && !diapos[actual].final) {
      transcurrido += dt;
      if (transcurrido >= DURACION) ir(actual + 1);
    }
    pintarProgreso();
    raf = requestAnimationFrame(bucle);
  }

  // ---- gestos: toque, mantener (pausa) y arrastrar hacia abajo (cerrar) ----
  let toque = null, tPausa;
  const pausar = (si) => { pausado = si; capa.classList.toggle("pausado", si); };
  capa.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    toque = { x: e.clientX, y: e.clientY, t: performance.now() };
    tPausa = setTimeout(() => pausar(true), 180);
  });
  capa.addEventListener("pointermove", (e) => {
    if (!toque) return;
    const dy = e.clientY - toque.y;
    if (dy > 0) {
      escena.style.transition = "none";
      escena.style.transform = `translateY(${dy * 0.7}px) scale(${1 - Math.min(dy, 500) / 2200})`;
      escena.style.borderRadius = Math.min(dy / 4, 36) + "px";
    }
  });
  const soltar = (e) => {
    if (!toque) return;
    clearTimeout(tPausa);
    const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
    const largo = performance.now() - toque.t > 260;
    toque = null;
    pausar(false);
    escena.style.transition = "";
    escena.style.transform = "";
    escena.style.borderRadius = "";
    if (e.type === "pointercancel") return;
    if (dy > 110) return cerrar();
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { vibrar(8); return ir(actual + (dx < 0 ? 1 : -1)); }
    if (largo || Math.hypot(dx, dy) > 12) return; // era una pausa o un arrastre corto
    vibrar(8);
    ir(actual + (e.clientX < innerWidth * 0.3 ? -1 : 1));
  };
  capa.addEventListener("pointerup", soltar);
  capa.addEventListener("pointercancel", soltar);

  const teclas = (e) => {
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowRight" || e.key === " ") ir(actual + 1);
    else if (e.key === "ArrowLeft") ir(actual - 1);
  };
  document.addEventListener("keydown", teclas);

  let cerrado = false;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("keydown", teclas);
    capa.classList.add("cerrando");
    document.body.style.overflow = "";
    setTimeout(() => capa.remove(), 380);
  }

  vibrar(15);
  construir();
  document.body.style.overflow = "hidden";
  document.body.append(capa);
  ir(0);
  raf = requestAnimationFrame(bucle);
}
