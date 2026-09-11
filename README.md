# 🌱 Nuestra lista

Web privada de pareja, inspirada en *Brochi: couple bucket list*, pero sin
cuentas, sin cuotas y solo para nosotros dos. Se abre acercando una pegatina
NFC al móvil (la pegatina apunta a la URL de GitHub Pages).

- **Lista de deseos** compartida: planes con nota, categoría, fecha y foto.
  Pendientes / Hechos, con buscador y filtro por categoría.
- **Recuerdos**: al completar un plan, se guarda con fotos, nota y lugar.
  Reacción ❤️ y buscador también.
- **Mapa** con un pin por cada recuerdo que tenga ubicación.
- **Inicio**: contador de "días juntos", "un día como hoy" (recuerdos de la
  misma fecha en años anteriores), countdown grande del próximo plan con
  fecha, último recuerdo, contadores, "🎲 Sorpréndeme" (plan pendiente al
  azar), "🎞️ Recuerdo al azar" y "📊 Resumen" (planes cumplidos, categoría
  favorita, sitios visitados, primer recuerdo, el más querido...).
- **Modo oscuro automático** (sigue el ajuste del sistema del móvil).

Los planes y recuerdos se sincronizan en vivo entre los dos móviles con
**Firestore** (Firebase); las fotos van a **Supabase Storage** (comprimidas
en el propio móvil antes de subir). Se usan dos servicios gratuitos en vez
de uno porque Firebase dejó de ofrecer Storage sin tarjeta — ver el porqué
en la sección 2. No hace falta instalar nada ni tocar terminal: todo se
gestiona desde las webs de GitHub, Firebase y Supabase.

---

## 1. Poner en marcha Firebase — datos (~10 min, gratis, sin tarjeta)

### 1.1. Crear el proyecto
1. Entra en **https://console.firebase.google.com** con una cuenta de Google.
2. **Crear proyecto** (o *Añadir proyecto*). Nombre: el que quieras
   (p. ej. `nuestra-lista`). Desactiva Google Analytics si pregunta.

### 1.2. Crear la base de datos (Firestore, no "Realtime Database")
1. Menú lateral: **Compilación → Firestore Database** (ojo, no *Realtime
   Database*, es otro producto) **→ Crear base de datos**.
2. Ubicación: una cercana a España, p. ej. `eur3`.
3. Empieza en **modo de prueba** y pulsa Crear.
4. Cuando cargue, ve a la pestaña **Reglas** y pega esto (déjalo listo ya
   para no depender de la caducidad de 30 días del modo de prueba):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Pulsa **Publicar**.

### 1.3. Registrar la web y copiar las claves
1. En la pantalla principal del proyecto, icono **`</>`** ("Añadir app → Web").
2. Apodo: `nuestra-lista-web`. **No** marques Firebase Hosting.
3. Firebase muestra un bloque `firebaseConfig` con varios valores
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`). Cópialos — `storageBucket` no hace falta
   pegarlo, no lo usamos (las fotos van a Supabase, ver abajo).
4. En este repo, edita **`js/config.js`** (con el lápiz de GitHub) y
   sustituye cada `"PEGA_AQUI_..."` de `firebaseConfig` por su valor.
   *Commit changes*.
5. De paso, en ese mismo archivo, cambia los **nombres** de `PERSONAS`
   (`Ander` / `Mi pareja`) por los reales. Deja los `id` (`ander`, `pareja`)
   tal cual si ya vas a grabar las pegatinas con ellos.
6. Y cambia también `FECHA_INICIO` por vuestra fecha (aniversario, primera
   cita...) en formato `"YYYY-MM-DD"` — es lo que muestra el contador de
   "días juntos" en Inicio. Ponlo en `null` para ocultar ese contador.

---

## 2. Poner en marcha Supabase — fotos (~5 min, gratis, sin tarjeta)

**¿Por qué dos servicios?** Desde octubre de 2024, Firebase Storage exige
pasar al plan de pago por uso ("Blaze", con tarjeta asociada) incluso para
la capa gratuita. Supabase ofrece un almacenamiento de archivos equivalente
sin pedir tarjeta, así que las fotos viven ahí y los planes/recuerdos
siguen en Firestore. Es un servicio más que gestionar, pero cero tarjetas.

> Su plan gratuito **pausa el proyecto tras ~1 semana sin actividad**. Si
> un día las fotos no cargan, entra en supabase.com, abre el proyecto y
> pulsa **Restore/Resume** (un clic, no se pierde nada) — vuelve a
> funcionar en un minuto.

### 2.1. Crear el proyecto
1. Entra en **https://supabase.com** y crea una cuenta gratis (con GitHub
   o email) — no pide tarjeta.
2. **New project**. Nombre: el que quieras. Contraseña de base de datos:
   genera una y guárdala en algún sitio (no la vamos a necesitar a mano,
   pero Supabase la pide igualmente). Región: la más cercana, p. ej.
   `eu-central-1 (Frankfurt)`. Plan: **Free**.
3. Espera 1-2 minutos a que se aprovisione.

### 2.2. Crear el bucket de fotos
1. Menú lateral: **Storage → New bucket**.
2. Nombre exacto: `fotos`.
3. Marca **Public bucket** (para que las URLs de las fotos se puedan ver
   directamente en la web).
4. En "Additional configuration": límite de tamaño de archivo `5 MB`,
   tipos MIME permitidos `image/*`. Crear.

### 2.3. Permitir subir y borrar fotos (políticas)
1. Dentro del bucket `fotos`, pestaña **Policies → New policy → For full
   customization** (o "Create a policy from scratch").
2. Nombre: `acceso total fotos`. Marca las 4 operaciones: **SELECT,
   INSERT, UPDATE, DELETE**. Target roles: déjalo en `public`/`anon`.
3. En la expresión (USING y WITH CHECK, si pide las dos) escribe:
   ```
   bucket_id = 'fotos'
   ```
4. Guardar.

### 2.4. Copiar las claves
1. **Project Settings (icono engranaje) → API**.
2. Copia **Project URL** y la clave **`anon` `public`**.
3. En este repo, edita **`js/config.js`** y sustituye en `supabaseConfig`
   `"PEGA_AQUI_supabaseUrl"` por la URL y `"PEGA_AQUI_supabaseAnonKey"`
   por la clave `anon`. *Commit changes*.

> **Sobre la seguridad, con franqueza:** tanto las reglas de Firestore
> como las políticas de Supabase dejan leer y escribir a cualquiera que
> conozca las claves del proyecto (que van en el código de la web, así que
> no son secretas). Con solo dos usuarios y sin datos sensibles (ni
> contraseñas, ni pagos), lo peor que podría pasar es que un desconocido
> que diera con la URL escribiera o borrara un plan o una foto — el límite
> de 5 MB por archivo acota además el peor caso de un abuso automatizado.
> Es el mismo modelo de confianza que [Baliza]. Si algún día preocupa de
> verdad, se puede añadir autenticación y restringir las reglas — no hace
> falta para empezar.

---

## 3. Publicar en GitHub Pages

1. **Settings → Pages → Build and deployment → Source** → *Deploy from a
   branch*, rama `main`, carpeta `/ (root)`. Guarda.
2. En 1-2 minutos estará en `https://TU-USUARIO.github.io/brochi/`.

---

## 4. Grabar las pegatinas NFC

Con **NFC Tools** (Android) o **Atajos** (iPhone), graba en cada pegatina un
registro de tipo *URL*:

```
https://TU-USUARIO.github.io/brochi/?yo=ander
https://TU-USUARIO.github.io/brochi/?yo=pareja
```

La primera vez que cada uno entre así, la web recuerda quién es en ese
teléfono. Si se abre sin `?yo=...` la primera vez, sale una pantalla para
elegir. Se puede cambiar luego tocando el nombre arriba a la derecha.

---

## 5. Instalarla como app en el móvil

Al abrir la web: en **Android/Chrome** aparece "Añadir a pantalla de
inicio"; en **iPhone/Safari**, botón Compartir → "Añadir a pantalla de
inicio". Luego se abre a pantalla completa como una app normal.

> En iPhone, ten en cuenta que la app instalada y Safari guardan cosas por
> separado a nivel de navegador, pero **los datos de verdad están en
> Firestore y Supabase**, así que se ven igual desde los dos sitios y
> desde los dos móviles.

---

## Modelo de datos (referencia rápida)

**`planes/{id}`** (Firestore): `titulo`, `nota`, `categoria`
(`viaje|cita|meta|aventura|otro|null`), `fechaObjetivo` (`"YYYY-MM-DD"|null`),
`fotoRef` (URL|null), `estado` (`pendiente|hecho`), `creadoPor`,
`completadoPor`, `recuerdoId`, `creadoEn`, `completadoEn`.

**`recuerdos/{id}`** (Firestore): `planId`, `titulo`, `nota`, `fotos` (URL[]),
`ubicacion` (`{texto, lat, lng}|null`), `creadoPor`, `creadoEn`,
`reacciones` (`{[personaId]: true}|undefined`, quién le ha dado ❤️).

Fotos (bucket `fotos` de Supabase Storage): `planes/{planId}/…` y
`recuerdos/{recuerdoId}/…`.

## Estructura

```
brochi/
├── index.html
├── manifest.webmanifest · sw.js
├── css/estilo.css
├── js/
│   ├── config.js          → claves de Firebase + Supabase + nombres + categorías
│   ├── firebase.js         → planes y recuerdos (Firestore)
│   ├── fotos.js            → subir/borrar fotos (Supabase Storage)
│   ├── identidad.js        → "¿quién eres?" (?yo= + localStorage)
│   ├── imagenes.js         → comprimir/redimensionar fotos en el móvil
│   ├── ui.js               → helpers: modal, toast, fechas, selector de fotos
│   ├── app.js              → shell, pestañas, estado en vivo, Inicio
│   ├── vista-lista.js      → lista de deseos
│   ├── vista-recuerdos.js  → recuerdos
│   └── vista-mapa.js       → mapa (Leaflet + OpenStreetMap)
└── icons/
```

## Si quieres regenerar los iconos

Los `icon-*.png` ya están incluidos. Para rehacerlos con otro color, edita
`icons/favicon.svg` y vuelve a exportar a 192 y 512 px (cualquier conversor
SVG→PNG online vale).

---

## Ideas para más adelante (no están hechas)

- "Spark" / sorpresa simultánea y termómetro de humor (como capricho).
- Cámara en la web con `getUserMedia` (ahora se suben fotos de la galería).
- Recordatorios push reales.

[Baliza]: https://github.com/anderbasa/baliza
