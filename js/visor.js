// Visor de fotos a pantalla completa, al estilo de la app Fotos de iOS:
// - deslizar a los lados entre las fotos (scroll nativo con "snap")
// - pellizcar para ampliar y mover con un dedo cuando esta ampliada
// - doble toque para acercar/alejar en ese punto
// - arrastrar hacia abajo para cerrar (la foto encoge y el fondo se aclara)
// - un toque esconde/ensena la barra de arriba y el pie
// - se abre creciendo desde la miniatura tocada y vuelve a ella al cerrar

import { el } from "./ui.js";

const CURVA = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export function abrirVisor(fotos, inicio = 0, { titulo = "", origen = null } = {}) {
  if (!fotos || !fotos.length) return;
  let actual = Math.min(Math.max(0, inicio), fotos.length - 1);

  const pista = el("div", { class: "visor-pista" });
  const slides = fotos.map((url) => {
    const img = el("img", { src: url, alt: "", draggable: "false" });
    pista.append(el("div", { class: "visor-slide" }, img));
    return { img, escala: 1, x: 0, y: 0 };
  });
  const fondo = el("div", { class: "visor-fondo" });
  const contador = el("span", { class: "visor-contador" });
  const capa = el("div", { class: "visor", role: "dialog", "aria-modal": "true", "aria-label": "Fotos" },
    fondo,
    pista,
    el("div", { class: "visor-barra" },
      contador,
      el("button", { class: "visor-cerrar", type: "button", "aria-label": "Cerrar", onclick: () => cerrar() }, "✕")
    ),
    titulo && el("p", { class: "visor-pie", text: titulo })
  );

  const overflowPrevio = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.body.append(capa);
  pista.scrollLeft = actual * pista.clientWidth;
  pintarContador();

  // ---- utilidades de zoom ----
  const transicion = (s, on) => { s.img.style.transition = on ? `transform .32s ${CURVA}` : "none"; };
  function aplicar(s) {
    s.img.style.transform = s.escala === 1 && !s.x && !s.y ? "" : `translate(${s.x}px, ${s.y}px) scale(${s.escala})`;
    const ampliada = s.escala > 1.01;
    pista.style.overflowX = ampliada ? "hidden" : "";
    pista.style.touchAction = ampliada ? "none" : "";
  }
  // vuelve a limites razonables: nunca mas pequena que la pantalla y sin
  // dejar bordes vacios al mover una foto ampliada
  function ajustar(s) {
    if (s.escala < 1) { s.escala = 1; s.x = 0; s.y = 0; }
    s.escala = Math.min(s.escala, 4);
    const maxX = Math.max(0, (s.img.offsetWidth * s.escala - innerWidth) / 2);
    const maxY = Math.max(0, (s.img.offsetHeight * s.escala - innerHeight) / 2);
    s.x = Math.max(-maxX, Math.min(maxX, s.x));
    s.y = Math.max(-maxY, Math.min(maxY, s.y));
  }
  function resetear(s) { s.escala = 1; s.x = 0; s.y = 0; transicion(s, false); aplicar(s); }

  function pintarContador() {
    contador.textContent = fotos.length > 1 ? `${actual + 1} de ${fotos.length}` : "";
  }

  // ---- cambio de foto al deslizar ----
  let tScroll;
  pista.addEventListener("scroll", () => {
    clearTimeout(tScroll);
    tScroll = setTimeout(() => {
      const i = Math.round(pista.scrollLeft / pista.clientWidth);
      if (i !== actual && slides[i]) {
        resetear(slides[actual]);
        actual = i;
        pintarContador();
      }
    }, 80);
  }, { passive: true });

  // ---- gestos tactiles ----
  // coordenadas respecto al centro de la pantalla = centro de la foto
  const rel = (t) => ({ x: t.clientX - innerWidth / 2, y: t.clientY - innerHeight / 2 });
  let ini = null, modo = null; // modo: "pellizco" | "mover" | "cerrar" | "nativo"
  let ultimoToque = 0, ultimoP = null, tToque = null;

  pista.addEventListener("touchstart", (e) => {
    const s = slides[actual];
    if (e.touches.length === 2) {
      const a = rel(e.touches[0]), b = rel(e.touches[1]);
      ini = { s0: s.escala, x0: s.x, y0: s.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      modo = "pellizco";
      transicion(s, false);
    } else if (e.touches.length === 1) {
      const p = rel(e.touches[0]);
      ini = { px: p.x, py: p.y, x0: s.x, y0: s.y, t: Date.now(), movido: false };
      modo = s.escala > 1.01 ? "mover" : null;
      transicion(s, false);
    }
  }, { passive: true });

  pista.addEventListener("touchmove", (e) => {
    if (!ini) return;
    const s = slides[actual];
    if (modo === "pellizco" && e.touches.length === 2) {
      e.preventDefault();
      const a = rel(e.touches[0]), b = rel(e.touches[1]);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const esc = Math.max(0.7, Math.min(5, (ini.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / ini.d0));
      // el punto entre los dedos se queda debajo de los dedos
      s.x = mx - ((ini.mx - ini.x0) * esc) / ini.s0;
      s.y = my - ((ini.my - ini.y0) * esc) / ini.s0;
      s.escala = esc;
      aplicar(s);
      return;
    }
    if (e.touches.length !== 1) return;
    const p = rel(e.touches[0]);
    const dx = p.x - ini.px, dy = p.y - ini.py;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) ini.movido = true;
    if (modo === "mover") {
      e.preventDefault();
      s.x = ini.x0 + dx; s.y = ini.y0 + dy;
      aplicar(s);
      return;
    }
    if (modo === null && ini.movido) modo = Math.abs(dy) > Math.abs(dx) && dy > 0 ? "cerrar" : "nativo";
    if (modo === "cerrar") {
      e.preventDefault();
      const k = Math.max(0.6, 1 - dy / 1100);
      s.img.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
      fondo.style.opacity = String(Math.max(0, 1 - dy / 350));
      capa.classList.add("sin-ui");
    }
  }, { passive: false });

  const finToque = (e) => {
    if (!ini) return;
    const s = slides[actual];
    // un toque sin mover el dedo es un toque, este o no ampliada la foto
    // (si no, con la foto ampliada el doble toque para alejar no llegaria)
    if (modo === "mover" && !ini.movido) modo = null;
    if (modo === "pellizco") {
      if (e.touches.length === 1) {
        // levanta un dedo: sigue moviendo con el otro
        const p = rel(e.touches[0]);
        ini = { px: p.x, py: p.y, x0: s.x, y0: s.y, t: Date.now(), movido: true };
        modo = s.escala > 1.01 ? "mover" : "nativo";
        return;
      }
      ajustar(s); transicion(s, true); aplicar(s);
    } else if (modo === "mover") {
      ajustar(s); transicion(s, true); aplicar(s);
    } else if (modo === "cerrar") {
      const dy = rel(e.changedTouches[0]).y - ini.py;
      const v = dy / Math.max(1, Date.now() - ini.t);
      if (dy > 110 || v > 0.6) { ini = null; modo = null; return cerrar(); }
      transicion(s, true); aplicar(s);
      fondo.style.opacity = "";
      capa.classList.remove("sin-ui");
    } else if (!ini.movido && e.type === "touchend") {
      const p = rel(e.changedTouches[0]);
      const ahora = Date.now();
      if (ahora - ultimoToque < 300 && ultimoP && Math.hypot(p.x - ultimoP.x, p.y - ultimoP.y) < 30) {
        // doble toque: acercar en ese punto, o volver a la foto entera
        clearTimeout(tToque); ultimoToque = 0;
        if (s.escala > 1.01) { s.escala = 1; s.x = 0; s.y = 0; }
        else { const k = 2.5; s.escala = k; s.x = p.x * (1 - k); s.y = p.y * (1 - k); ajustar(s); }
        transicion(s, true); aplicar(s);
      } else {
        ultimoToque = ahora; ultimoP = p;
        tToque = setTimeout(() => capa.classList.toggle("sin-ui"), 300);
      }
    }
    if (e.touches.length === 0) { ini = null; modo = null; }
  };
  pista.addEventListener("touchend", finToque);
  pista.addEventListener("touchcancel", finToque);

  // raton/teclado (ordenador)
  pista.addEventListener("dblclick", (e) => {
    const s = slides[actual], p = rel(e);
    if (s.escala > 1.01) { s.escala = 1; s.x = 0; s.y = 0; }
    else { const k = 2.5; s.escala = k; s.x = p.x * (1 - k); s.y = p.y * (1 - k); ajustar(s); }
    transicion(s, true); aplicar(s);
  });
  const teclas = (e) => {
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowRight") pista.scrollBy({ left: pista.clientWidth, behavior: "smooth" });
    else if (e.key === "ArrowLeft") pista.scrollBy({ left: -pista.clientWidth, behavior: "smooth" });
  };
  document.addEventListener("keydown", teclas);

  // ---- entrada: crece desde la miniatura ----
  const s0 = slides[actual];
  const haciaMiniatura = (s, mini) => {
    const T = mini.getBoundingClientRect();
    const w = s.img.offsetWidth, h = s.img.offsetHeight;
    if (!w || !h || !T.width) return null;
    const k = Math.min(T.width / w, T.height / h);
    return `translate(${T.left + T.width / 2 - innerWidth / 2}px, ${T.top + T.height / 2 - innerHeight / 2}px) scale(${k})`;
  };
  (async () => {
    if (origen && origen.isConnected) {
      try { await Promise.race([s0.img.decode(), new Promise((r) => setTimeout(r, 300))]); } catch (_) {}
      const desde = haciaMiniatura(s0, origen);
      if (desde) {
        s0.img.style.transition = "none";
        s0.img.style.transform = desde;
        fondo.style.opacity = "0";
        capa.getBoundingClientRect();
        s0.img.style.transition = `transform .4s ${CURVA}`;
        s0.img.style.transform = "";
        fondo.style.opacity = "";
        return;
      }
    }
    capa.classList.add("aparece");
  })();

  // ---- salida: vuelve a la miniatura si es la misma foto ----
  let cerrado = false;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(tToque);
    document.removeEventListener("keydown", teclas);
    capa.classList.add("sin-ui");
    const s = slides[actual];
    const destino = actual === inicio && origen && origen.isConnected ? haciaMiniatura(s, origen) : null;
    s.img.style.transition = `transform .3s ${CURVA}`;
    if (destino) s.img.style.transform = destino;
    else capa.classList.add("desaparece");
    fondo.style.opacity = "0";
    setTimeout(() => {
      capa.remove();
      document.body.style.overflow = overflowPrevio;
    }, 320);
  }

  return { cerrar };
}
