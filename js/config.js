// Claves de Firebase — se pegan aquí después de crear el proyecto en
// https://console.firebase.google.com (ver README.md, sección "Poner en marcha
// Firebase"). No son secretas: cualquiera que abra el código fuente de la web
// puede verlas. Eso es normal en apps web de Firebase — quien de verdad
// protege los datos son las Reglas de Seguridad de Firestore y Storage
// (también en el README), no estas claves.
export const firebaseConfig = {
  apiKey: "AIzaSyApC9XsdRHYqiQzrqwy6JKYnOOZcshUdZA",
  authDomain: "nuestra-lista-7b4a6.firebaseapp.com",
  projectId: "nuestra-lista-7b4a6",
  messagingSenderId: "609824735031",
  appId: "1:609824735031:web:2df034770a8a5e945524b2",
};

// Claves del proyecto de Supabase — solo se usan para las FOTOS (Supabase
// Storage), porque su capa gratuita no exige tarjeta (a diferencia de
// Firebase Storage). Los planes y recuerdos siguen en Firestore, arriba.
// Ver README.md, sección 1.3. La "anon key" es pública a propósito (como
// las claves de Firebase): la protección real son las políticas del bucket.
export const supabaseConfig = {
  url: "https://clmavzyscvgjpjewnfoj.supabase.co/rest/v1/",
  anonKey: "sb_publishable_gvbeeyIWRk6CzKZsbQw8mg_3Xi1vev0",
};

// Las dos personas de la app. Cada pegatina NFC graba la URL con su "id" en el
// parámetro `yo`, por ejemplo:
//   https://TU-USUARIO.github.io/brochi/?yo=ander
//   https://TU-USUARIO.github.io/brochi/?yo=pareja
// El nombre se puede cambiar cuando quieras; el id conviene no tocarlo una vez
// grabadas las pegatinas.
export const PERSONAS = {
  ander: { id: "ander", nombre: "Ander", color: "#c2703d" },
  pareja: { id: "pareja", nombre: "Naia", color: "#7a9b76" },
};

// Categorías disponibles al crear un plan (icono + etiqueta).
export const CATEGORIAS = [
  { id: "viaje", etiqueta: "Viaje", emoji: "✈️" },
  { id: "cita", etiqueta: "Cita", emoji: "🕯️" },
  { id: "meta", etiqueta: "Meta", emoji: "🎯" },
  { id: "aventura", etiqueta: "Aventura", emoji: "🏔️" },
  { id: "otro", etiqueta: "Otro", emoji: "✨" },
];

// Fecha desde la que contar los días juntos en el contador de Inicio
// ("YYYY-MM-DD"). Pon aquí vuestra fecha (aniversario, primera cita...).
// Déjalo en `null` para ocultar el contador si no queréis usarlo.
export const FECHA_INICIO = "2020-06-15";
