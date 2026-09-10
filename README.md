# 🌱 Nuestra lista

Web privada de pareja, inspirada en *Brochi: couple bucket list*, pero sin
cuentas, sin cuotas y solo para nosotros dos. Se abre acercando una pegatina
NFC al móvil (la pegatina apunta a la URL de GitHub Pages).

- **Lista de deseos** compartida: planes con nota, categoría, fecha y foto.
  Pendientes / Hechos.
- **Recuerdos**: al completar un plan, se guarda con fotos, nota y lugar.
- **Mapa** con un pin por cada recuerdo que tenga ubicación.
- **Inicio** con el resumen: próximos planes, último recuerdo y contadores.

Los datos se sincronizan en vivo entre los dos móviles con **Firestore**;
las fotos van a **Firebase Storage** (comprimidas en el propio móvil antes
de subir). No hace falta instalar nada ni tocar terminal: todo se gestiona
desde la web de GitHub y la consola de Firebase.

---

## 1. Poner en marcha Firebase (una sola vez, ~10 min)

La capa gratuita de Firebase es de sobra para dos personas.

### 1.1. Crear el proyecto
1. Entra en **https://console.firebase.google.com** con una cuenta de Google.
2. **Crear proyecto** (o *Añadir proyecto*). Nombre: el que quieras
   (p. ej. `nuestra-lista`). Desactiva Google Analytics si pregunta.

### 1.2. Crear la base de datos (Firestore)
1. Menú lateral: **Compilación → Firestore Database → Crear base de datos**.
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

### 1.3. Crear el almacenamiento de fotos (Storage)
1. Menú lateral: **Compilación → Storage → Comenzar**.
2. Acepta la ubicación que propone (la misma del proyecto) y crea.
3. Pestaña **Reglas** de Storage, pega esto y **Publica**:

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```

> **Sobre la seguridad, con franqueza:** estas reglas dejan leer y escribir
> a cualquiera que conozca las claves del proyecto (que van en el código de
> la web, así que no son secretas). Con solo dos usuarios y sin datos
> sensibles (ni contraseñas, ni pagos), lo peor que podría pasar es que un
> desconocido que diera con la URL escribiera o borrara un plan. Es el mismo
> modelo de confianza que [Baliza]. Si algún día preocupa de verdad, se
> puede añadir "inicio de sesión anónimo" de Firebase y restringir las
> reglas —no hace falta para empezar.

### 1.4. Registrar la web y copiar las claves
1. En la pantalla principal del proyecto, icono **`</>`** ("Añadir app → Web").
2. Apodo: `nuestra-lista-web`. **No** marques Firebase Hosting.
3. Firebase muestra un bloque `firebaseConfig` con 6 valores. Cópialos.
4. En este repo, edita **`js/config.js`** (con el lápiz de GitHub) y
   sustituye cada `"PEGA_AQUI_..."` por su valor. *Commit changes*.
5. De paso, en ese mismo archivo, cambia los **nombres** de `PERSONAS`
   (`Ander` / `Mi pareja`) por los reales. Deja los `id` (`ander`, `pareja`)
   tal cual si ya vas a grabar las pegatinas con ellos.

---

## 2. Publicar en GitHub Pages

1. **Settings → Pages → Build and deployment → Source** → *Deploy from a
   branch*, rama `main`, carpeta `/ (root)`. Guarda.
2. En 1-2 minutos estará en `https://TU-USUARIO.github.io/brochi/`.

---

## 3. Grabar las pegatinas NFC

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

## 4. Instalarla como app en el móvil

Al abrir la web: en **Android/Chrome** aparece "Añadir a pantalla de
inicio"; en **iPhone/Safari**, botón Compartir → "Añadir a pantalla de
inicio". Luego se abre a pantalla completa como una app normal.

> En iPhone, ten en cuenta que la app instalada y Safari guardan cosas por
> separado a nivel de navegador, pero **los datos de verdad están en
> Firestore**, así que se ven igual desde los dos sitios y desde los dos
> móviles.

---

## Modelo de datos (referencia rápida)

**`planes/{id}`**: `titulo`, `nota`, `categoria` (`viaje|cita|meta|aventura|otro|null`),
`fechaObjetivo` (`"YYYY-MM-DD"|null`), `fotoRef` (URL|null), `estado`
(`pendiente|hecho`), `creadoPor`, `completadoPor`, `recuerdoId`, `creadoEn`,
`completadoEn`.

**`recuerdos/{id}`**: `planId`, `titulo`, `nota`, `fotos` (URL[]),
`ubicacion` (`{texto, lat, lng}|null`), `creadoPor`, `creadoEn`.

Fotos en Storage: `planes/{planId}/…` y `recuerdos/{recuerdoId}/…`.

## Estructura

```
brochi/
├── index.html
├── manifest.webmanifest · sw.js
├── css/estilo.css
├── js/
│   ├── config.js          → claves de Firebase + nombres + categorías
│   ├── firebase.js         → TODA la lectura/escritura (Firestore + Storage)
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
