# A♥N · Nuestra lista

Web privada de pareja, inspirada en *Brochi: couple bucket list*, pero sin
cuentas, sin cuotas y solo para nosotros dos. Se abre acercando una pegatina
NFC al móvil (la pegatina apunta a la URL de GitHub Pages).

- **Lista de deseos** compartida: planes con nota, categoría, fecha y foto.
  Pendientes / Hechos, con buscador y filtro por categoría.
- **Recuerdos**: al completar un plan, se guarda con fotos, nota y lugar.
  Reacción ❤️ y buscador también.
- **Mapa** a pantalla completa, como el de Fotos: cada recuerdo es un pin
  con su foto, los cercanos se juntan en una burbuja con el número, y abajo
  hay un carrusel de tarjetas (deslizarlo mueve el mapa; tocar un pin mueve
  el carrusel). Los recuerdos **sin sitio** se pueden poner en el mapa
  cuando sea, aunque haya pasado tiempo.
- **Elegir el sitio a mano** ("soltar un pin", como en Mapas): al completar
  un plan, al editar un recuerdo o desde su detalle. El pin se queda en el
  centro y se mueve el mapa; también se puede buscar un sitio por nombre o
  usar la ubicación actual. Debajo sale el nombre del sitio.
- **Nuestro año**: el resumen del año en historias a pantalla completa (tipo
  Wrapped): planes cumplidos, recuerdos y fotos, el mes con más recuerdos,
  la categoría favorita, los sitios, quién ha dado más ❤️, el recuerdo del
  año y lo que queda por venir. Al final se comparte como imagen.
- **Inicio**: contador de "días juntos", "un día como hoy" (recuerdos de la
  misma fecha en años anteriores), countdown grande del próximo plan con
  fecha, la tarjeta de "Nuestro año", último recuerdo, contadores,
  "🎲 Sorpréndeme" (plan pendiente al azar) y "🎞️ Recuerdo al azar".
- **Modo oscuro automático** (sigue el ajuste del sistema del móvil).
- **Hecha para iPhone**: icono con vuestro monograma A♥N, pantalla de carga
  propia que enlaza con una animación de "latido" al abrir, la app a
  pantalla completa bajo la Dynamic Island, hojas que se cierran
  deslizando hacia abajo como las de iOS, toque háptico real al completar
  un plan o dar ❤️ (iOS 18 o posterior), explosión de corazones,
  **compartir un recuerdo** como tarjeta (foto + título + fecha + lugar)
  con el menú de compartir de iOS, **visor de fotos** como el de Fotos
  (deslizar, pellizcar, doble toque, arrastrar abajo para cerrar), iconos
  de línea en la barra de abajo que se rellenan en la pestaña activa, y
  **avisos en directo**: con la app abierta, si el otro añade un plan,
  guarda un recuerdo o da un ❤️, baja una notificación desde arriba.
  Y animaciones de iPhone: **mantener pulsada** una tarjeta la levanta y
  saca un menú (como el Haptic Touch), las tarjetas entran en cascada con
  efecto muelle, las pestañas se funden al cambiar y los números cuentan.

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
│   ├── ui.js               → helpers: hojas iOS, toast, fechas, háptico, corazones
│   ├── app.js              → shell, pestañas, estado en vivo, arranque, Inicio
│   ├── vista-lista.js      → lista de deseos
│   ├── vista-recuerdos.js  → recuerdos
│   ├── vista-mapa.js       → mapa con pines de foto y carrusel (Leaflet)
│   ├── mapa-comun.js       → teselas OSM, búsqueda de sitios, mini mapa
│   ├── selector-mapa.js    → elegir un sitio a mano ("soltar un pin")
│   ├── resumen-anual.js    → "Nuestro año" en historias
│   ├── visor.js            → visor de fotos a pantalla completa
│   ├── avisos.js           → avisos en directo de lo que hace el otro
│   └── compartir.js        → tarjeta para compartir un recuerdo
├── icons/
│   ├── icon-*.png · apple-touch-icon.png · favicon.png → el icono A♥N
│   ├── monograma.png       → el monograma suelto (arranque, tarjetas)
│   └── splash/             → pantallas de carga para iOS (ver más abajo)
└── herramientas/           → el generador del icono y las pantallas de carga
```

## El icono y la pantalla de carga en iPhone

El icono es el monograma **A♥N** sobre el degradado terracota. Va
**cuadrado y sin esquinas redondeadas** a propósito: iOS les pone las
suyas a todos los iconos, y si el dibujo ya las trae, quedan dobles.

Al abrir la app desde la pantalla de inicio, iOS muestra una pantalla de
carga propia (`icons/splash/*.jpg`: el fondo del icono a pantalla completa
con el monograma, en claro y en oscuro, para los tamaños de iPhone más
comunes) y la app continúa con la misma imagen (`#arranque` en
`index.html`), que da un "latido" y deja paso a Inicio.

Para rehacer el icono, el monograma o las pantallas de carga (por ejemplo,
si cambiáis colores o iniciales):

```
node herramientas/servidor.js
```

y abrir `http://localhost:4191/generar-iconos.html`; en la consola del
navegador, `await exportarTodo()` reescribe todo en `icons/`. Los tamaños
de iPhone están en la lista `TAMANOS` de ese archivo y en los
`apple-touch-startup-image` de `index.html`: si añadís un modelo nuevo,
hay que tocar los dos sitios.

## El mapa: todo gratis y sin claves

- Las **teselas** son las de OpenStreetMap, con un filtro CSS para que
  casen con los colores de la app (y otro para el modo oscuro). Los de
  CARTO, más bonitos, ahora piden clave: por eso no se usan.
- La **búsqueda de sitios** y el nombre bajo el pin son de Nominatim
  (OpenStreetMap). Sus normas: no buscar mientras se escribe (solo al pulsar
  Buscar) y no más de una petición por segundo; la app ya lo respeta.
- Las **burbujas** que juntan pines son Leaflet.markercluster (cdnjs).

Ojo al tocar los formularios: un campo con varios botones dentro (fotos,
categorías, ubicación) tiene que ir en un `<div>`, no en un `<label>`. En
iPhone, cualquier toque dentro de un `<label>` pulsa su primer botón: eso
fue lo que estropeó el primer intento de elegir el sitio en el mapa.

---

## Ideas para más adelante (no están hechas)

- "Spark" / sorpresa simultánea y termómetro de humor (como capricho).
- Cámara en la web con `getUserMedia` (ahora se suben fotos de la galería).
- Recordatorios push reales.

[Baliza]: https://github.com/anderbasa/baliza
