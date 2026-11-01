// Compartir un recuerdo: crea una tarjeta (foto + titulo + fecha + lugar +
// el monograma A♥N) y la pasa al menu de compartir del sistema (en iPhone,
// el de siempre: WhatsApp, Mensajes, Instagram, Guardar imagen...).
//
// Va en dos pasos a proposito: primero se prepara la tarjeta y se ensena, y
// el boton "Compartir" de la vista previa llama a navigator.share() en el
// mismo toque. Safari exige que share() salga directamente de un toque, y
// preparar la imagen (descargar la foto, dibujar) tarda demasiado para eso.

import { el, abrirModal, cerrarModal, aviso, mensajeError, vibrar, fechaTS, fechaLegible } from "./ui.js";

const W = 1080, H = 1350; // 4:5, el formato vertical de Instagram

async function cargarFoto(url) {
  const resp = await fetch(url, { mode: "cors" });
  if (!resp.ok) throw new Error("foto " + resp.status);
  return createImageBitmap(await resp.blob());
}

function cargarLocal(src) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = src;
  });
}

// Corta el texto en lineas que quepan en `ancho`, con "…" si sobra.
function lineas(ctx, texto, ancho, max) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const out = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? actual + " " + p : p;
    if (ctx.measureText(prueba).width <= ancho) actual = prueba;
    else { if (actual) out.push(actual); actual = p; }
  }
  if (actual) out.push(actual);
  if (out.length > max) {
    out.length = max;
    let ultima = out[max - 1];
    while (ultima && ctx.measureText(ultima + "…").width > ancho) ultima = ultima.slice(0, -1);
    out[max - 1] = ultima.trimEnd() + "…";
  }
  return out;
}

function cubrir(ctx, img, x, y, w, h) {
  const iw = img.width, ih = img.height;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

async function crearTarjeta(r) {
  await Promise.all([
    document.fonts.load("italic 500 64px Fraunces"),
    document.fonts.load("700 32px Nunito"),
    document.fonts.load("400 32px Nunito"),
  ]).catch(() => {});

  // sin nota la foto crece, para que el panel de abajo no quede medio vacio
  const FOTO_H = r.nota ? 860 : 960;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f7efe6";
  ctx.fillRect(0, 0, W, H);

  // Arriba: la primera foto, o el fondo de marca con el monograma si no hay
  let foto = null;
  if (r.fotos && r.fotos[0]) {
    try { foto = await cargarFoto(r.fotos[0]); } catch (_) { foto = null; }
  }
  if (foto) {
    cubrir(ctx, foto, 0, 0, W, FOTO_H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, FOTO_H);
    g.addColorStop(0, "#d27748"); g.addColorStop(0.6, "#a8492a"); g.addColorStop(1, "#6f2a1b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, FOTO_H);
    try {
      const mono = await cargarLocal("icons/monograma.png");
      ctx.drawImage(mono, W / 2 - 260, FOTO_H / 2 - 260, 520, 520);
    } catch (_) {}
  }

  // Panel crema con esquinas redondeadas que monta sobre la foto
  const top = FOTO_H - 48;
  ctx.fillStyle = "#f7efe6";
  ctx.beginPath();
  ctx.moveTo(0, top + 48); ctx.arcTo(0, top, 48, top, 48);
  ctx.lineTo(W - 48, top); ctx.arcTo(W, top, W, top + 48, 48);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  const x = 72, ancho = W - 144;
  let y = top + 108;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#3a322c";
  ctx.font = "italic 500 66px Fraunces, Georgia, serif";
  for (const l of lineas(ctx, r.titulo, ancho, 2)) { ctx.fillText(l, x, y); y += 76; }

  const meta = [fechaLegible(fechaTS(r.creadoEn)), r.ubicacion?.texto ? "📍 " + r.ubicacion.texto : ""].filter(Boolean).join("  ·  ");
  ctx.fillStyle = "#a95c2d";
  ctx.font = "700 32px Nunito, system-ui, sans-serif";
  for (const l of lineas(ctx, meta, ancho, 1)) { ctx.fillText(l, x, y + 4); y += 52; }

  if (r.nota) {
    ctx.fillStyle = "#6a5f55";
    ctx.font = "400 32px Nunito, system-ui, sans-serif";
    y += 6;
    for (const l of lineas(ctx, r.nota, ancho, 2)) { ctx.fillText(l, x, y); y += 44; }
  }

  // Firma: el icono A♥N y el nombre, abajo
  try {
    const icono = await cargarLocal("icons/icon-192.png");
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, H - 118, 64, 64, 15); ctx.clip();
    ctx.drawImage(icono, x, H - 118, 64, 64);
    ctx.restore();
  } catch (_) {}
  ctx.fillStyle = "#a95c2d";
  ctx.font = "italic 500 34px Fraunces, Georgia, serif";
  ctx.fillText("Nuestra lista", x + 84, H - 74);

  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("tarjeta"))), "image/jpeg", 0.9));
}

function textoRecuerdo(r) {
  const fecha = fechaLegible(fechaTS(r.creadoEn));
  const lugar = r.ubicacion?.texto ? ` · 📍 ${r.ubicacion.texto}` : "";
  return `${r.titulo} — ${fecha}${lugar}${r.nota ? "\n" + r.nota : ""}`;
}

export async function compartirRecuerdo(r) {
  const estado = el("p", { class: "sub", text: "Preparando la tarjeta…" });
  const cont = el("div", { class: "compartir" }, el("h3", { text: "Compartir recuerdo" }), estado);
  abrirModal(cont);

  let blob;
  try {
    blob = await crearTarjeta(r);
  } catch (err) {
    console.error(err);
    estado.textContent = "No se pudo preparar la tarjeta.";
    return;
  }
  if (!cont.isConnected) return; // la cerraron mientras se preparaba

  const nombreArchivo = (r.titulo || "recuerdo").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "recuerdo";
  const archivo = new File([blob], `${nombreArchivo}.jpg`, { type: "image/jpeg" });
  const conArchivo = !!navigator.canShare?.({ files: [archivo] });
  const url = URL.createObjectURL(blob);

  estado.remove();
  cont.append(
    el("img", { class: "compartir-img", src: url, alt: "Tarjeta del recuerdo" }),
    el("p", { class: "form-sub", text: "También puedes mantener pulsada la imagen para guardarla en Fotos." }),
    el("div", { class: "form-acciones" },
      el("button", { type: "button", class: "btn-plano", onclick: cerrarModal }, "Cerrar"),
      el("button", {
        type: "button",
        class: "btn-primario",
        onclick: async () => {
          vibrar();
          try {
            if (conArchivo) await navigator.share({ files: [archivo], title: r.titulo });
            else await navigator.share({ title: r.titulo, text: textoRecuerdo(r) });
          } catch (err) {
            if (err && err.name !== "AbortError") aviso(mensajeError(err, "No se pudo compartir"), "error");
          }
        },
      }, "📤 Compartir")
    )
  );
}
