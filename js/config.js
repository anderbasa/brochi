// Claves de Firebase — se pegan aquí después de crear el proyecto en
// https://console.firebase.google.com (ver README.md, sección "Poner en marcha
// Firebase"). No son secretas: cualquiera que abra el código fuente de la web
// puede verlas. Eso es normal en apps web de Firebase — quien de verdad
// protege los datos son las Reglas de Seguridad de Firestore y Storage
// (también en el README), no estas claves.
export const firebaseConfig = {
  apiKey: "PEGA_AQUI_apiKey",
  authDomain: "PEGA_AQUI_authDomain",
  projectId: "PEGA_AQUI_projectId",
  storageBucket: "PEGA_AQUI_storageBucket",
  messagingSenderId: "PEGA_AQUI_messagingSenderId",
  appId: "PEGA_AQUI_appId",
};

// Las dos personas de la app. Cada pegatina NFC graba la URL con su "id" en el
// parámetro `yo`, por ejemplo:
//   https://TU-USUARIO.github.io/brochi/?yo=ander
//   https://TU-USUARIO.github.io/brochi/?yo=pareja
// El nombre se puede cambiar cuando quieras; el id conviene no tocarlo una vez
// grabadas las pegatinas.
export const PERSONAS = {
  ander: { id: "ander", nombre: "Ander", color: "#c2703d" },
  pareja: { id: "pareja", nombre: "Mi pareja", color: "#7a9b76" },
};

// Categorías disponibles al crear un plan (icono + etiqueta).
export const CATEGORIAS = [
  { id: "viaje", etiqueta: "Viaje", emoji: "✈️" },
  { id: "cita", etiqueta: "Cita", emoji: "🕯️" },
  { id: "meta", etiqueta: "Meta", emoji: "🎯" },
  { id: "aventura", etiqueta: "Aventura", emoji: "🏔️" },
  { id: "otro", etiqueta: "Otro", emoji: "✨" },
];
