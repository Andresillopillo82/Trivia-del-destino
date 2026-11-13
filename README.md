# Trivia del Destino

PWA de preguntas de cultura general ambientada en las cartas del tarot. Los participantes juegan desde su celular y la PC de la exposición muestra la clasificación en vivo.

Cada día, una carta del tarot elegida al azar decide la categoría de tu pregunta. Si aciertas, desbloqueas un reto para un compañero. Al cabo de una semana, quien más puntos tenga recibe el título de **Dueño del Destino**.

**Stack:** Vite + React + TypeScript + Tailwind CSS + Framer Motion + `vite-plugin-pwa` + Firebase en el plan gratuito Spark (Firestore, Authentication anónima y Hosting). No usa Cloud Functions.

---

## 0. Replicar el proyecto en otro PC

**Programas:** Git, Node.js 20 o superior (probado con 24) y Android Studio (trae el JDK que usa Gradle y que sirve para el emulador de Firebase).

```bash
git clone https://github.com/Andresofsouls/trivia-del-destino.git
cd trivia-del-destino
npm install
```

El repositorio no incluye la configuración de Firebase ni las claves de firma. Hay dos caminos:

| | Mismo Firebase (`trivia-59073`), para jugar con los mismos datos | Firebase propio |
|---|---|---|
| Web | Pide al dueño el archivo `.env` y ponlo en la raíz | Sigue los pasos 1 y 2 de abajo |
| Android | Pide `google-services.json` y ponlo en `android/app/` | En Firebase, registra una app **Android** con el paquete `com.triviadeldestino.app` y descarga su `google-services.json` a `android/app/` |
| Reglas | Ya están desplegadas | `npx firebase login` y `npm run deploy:rules` |
| Desplegar la web | Hace falta que el dueño te añada al proyecto en la consola de Firebase | `npm run deploy` |

Luego:

- **Web:** `npm run dev` y abre http://localhost:5173.
- **Android:** abre la carpeta `android/` en Android Studio, espera el *Gradle Sync* y pulsa *Run* (emulador o teléfono con Android 8 o superior). El banco de preguntas se copia solo desde `src/data/questions.json` al compilar.
- **Pruebas:** `npm test` (web) y, en `android/`, `./gradlew :app:testDebugUnitTest`.
- **Versión release firmada (opcional):** necesita tu propio `android/keystore.properties` y keystore; los pasos están en `android/README.md`. Con otra firma, los enlaces `…/unirse/` y `…/rapida/` abren la web en lugar de la app hasta que se añada su huella a `public/.well-known/assetlinks.json`.

## 1. Configurar Firebase (una sola vez)

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto. Google Analytics no hace falta.
2. En **Authentication → Método de acceso**, activa **Anónimo**.
3. En **Firestore Database → Crear base de datos**, elige **modo producción** y una región cercana.
4. En **Configuración del proyecto → Tus apps**, registra una app **web** (icono `</>`) y copia el objeto `firebaseConfig`.

## 2. Variables de entorno

```bash
cp .env.example .env
cp .firebaserc.example .firebaserc
```

- Rellena `.env` con los valores de `firebaseConfig`.
- Pon el id de tu proyecto en `.firebaserc`.

Ambos archivos están en `.gitignore`. Los valores de `firebaseConfig` no son secretos, porque viajan al navegador; lo que protege los datos son las reglas de Firestore.

## 3. Ejecutar en local

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Chequeo de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción en local (con la PWA activa) |
| `npm test` | Pruebas unitarias de la lógica de juego (`src/game/`) |
| `npm run test:rules:emu` | Prueba de `firestore.rules` en el emulador local de Firebase (necesita Java: sirve el JDK de Android Studio) |
| `npm run test:rules` | La misma prueba contra tu proyecto, con las reglas desplegadas |
| `npm run deploy:rules` | Despliega solo las reglas e índices de Firestore |
| `npm run deploy` | Build + despliegue de Hosting y Firestore |

## 4. Desplegar

```bash
npx firebase login       # una vez, con la cuenta dueña del proyecto
npm run deploy           # compila y publica la app (Hosting) y las reglas (Firestore)
```

La app queda publicada en `https://<tu-proyecto>.web.app`.

Para probar las reglas **antes** de desplegarlas, ejecuta `npm run test:rules:emu` con Java en el `PATH` (en Windows sirve el de Android Studio: `C:\Program Files\Android\Android Studio\jbr\bin`). Para comprobar las ya desplegadas, `npm run test:rules`. La prueba crea un grupo temporal con cuatro usuarios anónimos, comprueba más de cien casos permitidos y rechazados (incluida la devolución de retos con sus dos resultados) y al final borra todo lo que creó.

## 5. Instalar la PWA en el celular

- **Android (Chrome):**
  1. Abre la URL de la app.
  2. Usa **Perfil → Instalar en este dispositivo**, o el menú ⋮ → **Instalar app**.
- **iPhone / iPad (Safari):**
  1. Abre la URL de la app.
  2. Toca **Compartir**.
  3. Elige **Añadir a pantalla de inicio**.
- **PC (Chrome / Edge):** usa el icono de instalación en la barra de direcciones.

Una vez instalada, se abre a pantalla completa y conserva la sesión. Sin conexión se puede ver la última clasificación guardada; para revelar la carta del día hace falta internet.

---

## Guion para presentar la demo

### Antes de abrir el stand (5 minutos)

1. En la **PC de la exposición**, abre la app y crea un perfil (por ejemplo, "Stand").
2. Crea el grupo y **desmarca "También voy a jugar desde este dispositivo"**. Así la PC será la administradora y la pantalla de presentación.
3. Entra en **Admin → Añadir jugadores simulados (bots)**. En unos segundos los 6 bots juegan el día 1 y la clasificación cobra vida.
4. Pulsa **Admin → Abrir modo presentación** y luego **F** para ponerla a pantalla completa.

### Con el público (ciclo de 3 a 5 minutos por visitante)

1. **"Escanea el QR."** El visitante entra con el código ya escrito, elige apodo y símbolo y se une al grupo.
2. **"Revela tu destino."** El mazo se baraja, se voltea una carta y su arcano decide la categoría: por ejemplo, El Mundo → Geografía. Si no le gusta, puede usar su **comodín** (uno al día) para cambiarla. Al pulsar "Ver la pregunta" tiene 20 s, y si responde en menos de 8 obtiene un bonus. Cada día hay **3 cartas**.
3. **En la pantalla grande:** su nombre aparece en la clasificación, y en "Lo último" aparece "… acertó con El Mago (+7)".
4. **"Reta a alguien."** Con 2 aciertos en el día elige a alguien del grupo (un bot o un amigo) y le envía una pregunta difícil. Si el otro falla, el visitante gana +10.
5. **Si un bot lo retó**, en su celular aparece la **Carta de Reto** carmesí. El reto es obligatorio antes de su siguiente carta, pero puede **devolverlo**: gira la Rueda de la Fortuna (30 % de éxito).

### Para mostrar el paso de la semana

- En la PC, pulsa **N** en el modo presentación (o **Admin → Avanzar día**). Todos los celulares ven el nuevo día al instante y los bots juegan.
- Para el cierre, usa **Admin → Saltar al final de la semana**. Los bots juegan los días restantes, la pantalla muestra la **carta dorada del Dueño del Destino** con confeti, y cada celular pasa a la ceremonia con El Vidente (más aciertos seguidos) y El Retador (más retos ganados).
- Para empezar de nuevo, usa **Admin → Reiniciar grupo**: se mantienen las personas y se borran puntos y bots.
- Al terminar la convención, usa **Admin → Eliminar grupo**.

### Consejos

- **Wifi del recinto:** sacar una carta, ver la pregunta y devolver un reto exigen conexión, porque el servidor fija la hora. Si la red falla, la app lo avisa con una barra roja.
- **Bots:** solo juegan **mientras la PC del administrador tiene la app abierta**, porque sin Cloud Functions no hay servidor que los mueva. Deja la presentación abierta.
- **Un dispositivo, una identidad:** cada navegador es un jugador anónimo. En la misma PC no se puede jugar como dos personas (salvo con otro perfil del navegador).

---

## Partida Rápida

Un segundo modo, aparte del Modo Destino: una **sala temporal por código** en la que todos juegan a la vez contrarreloj. No hace falta pertenecer a un grupo (basta con el apodo), no cuenta para la clasificación y no guarda historial: los resultados existen solo mientras la sala está abierta. Funciona igual en la web y en la app Android, y ambas pueden jugar en la misma sala.

### Cómo se juega

1. **Crear sala** (Inicio → *Partida Rápida* → *Crear sala*). *Participo* si el anfitrión también juega; *Solo pantalla* si ese dispositivo solo proyecta y dirige.
2. **Unirse**: escanear el QR, abrir el enlace `…/rapida/CÓDIGO` o escribir el código. Solo se entra mientras la sala está en el lobby (máximo 20 jugadores, sin contar los bots).
3. El anfitrión puede **añadir hasta 6 bots** y pulsa **Iniciar**. Cada dispositivo hace su cuenta atrás 3-2-1 y empieza.
4. Cada jugador tiene **45 s**: acierto **+2 s**, fallo **−2 s**, con un techo de 60 s restantes. El reloj nunca se pausa: el aviso de acierto/fallo dura 250 ms y la siguiente pregunta aparece enseguida. Si una penalización deja el reloj en 0, terminas al instante.
5. **Todos ven las mismas preguntas en el mismo orden** (la semilla de la sala decide la secuencia), sin repetir y sin dos cartas seguidas iguales. La dificultad sube: preguntas 1–5 normales; 6–10, 25 % difíciles; 11–15, 50 %; 16–20, 75 %; de la 21 en adelante, todas difíciles.
6. La partida termina cuando todos terminan, a los 5 minutos del inicio como máximo, o cuando el anfitrión pulsa **Terminar ahora**.
7. **Ganador**: más aciertos; si empatan, menos fallos; si siguen empatados, comparten el puesto. Cada jugador ve además su resumen: las preguntas que vio, su respuesta y la correcta con la explicación.
8. **Revancha** (anfitrión): misma sala, semilla nueva y vuelta al lobby, evitando en lo posible las preguntas de la ronda anterior. **Cerrar sala** borra la sala y sus jugadores.

Todos los valores están en `gameConfig.quickMatch` (`src/config/gameConfig.ts`; en Android, `QuickMatchConfig` en `game/Quick.kt`), incluida la tabla de dificultad. `maxSeconds: null` quita el techo.

### Cómo proyectarla en una PC

- Abre `https://trivia-59073.web.app/sala/CÓDIGO/pantalla` en la PC (el anfitrión tiene el enlace *Abrir pantalla para PC* en el lobby). Es de solo lectura y no pide apodo: en el lobby muestra el código y el QR en grande; durante la partida, barras en vivo con los aciertos de cada jugador; al terminar, el podio.
- O crea la sala desde la PC con *Solo pantalla*: verás lo mismo, con los botones para iniciar, añadir bots, terminar, pedir la revancha y cerrar.

### Datos y consumo

| Documento | Contenido |
|---|---|
| `quickRooms/{code}` | hostUid, hostPlays, status (`lobby`/`playing`/`finished`), round, seed, config (copia de `quickMatch`), evitar (preguntas de la ronda anterior), createdAt, startedAt, expiresAt |
| `quickRooms/{code}/players/{uid}` | apodo, avatar, esBot, round, correctas, falladas, finished, updatedAt |

No se guardan las respuestas, solo contadores; cada dispositivo conserva en memoria sus preguntas para el resumen final. Para no gastar el plan gratuito, cada jugador escribe al unirse, como mucho cada 5 s durante la partida (solo si cambió algo) y al terminar. Durante la partida, los jugadores solo escuchan el documento de la sala; la lista de jugadores se escucha en el lobby, al terminar, en la pantalla de sala y en el dispositivo del anfitrión, que es quien simula los bots y cierra la partida. Con 20 jugadores, una ronda son unas 250 escrituras.

### Caducidad (TTL)

Cada sala guarda `expiresAt` (creación + 6 h); la app ignora las salas caducadas y las reglas no dejan entrar en ellas. Si el anfitrión no cierra la sala, quedan documentos huérfanos. Como respaldo, activa una política TTL en Firestore:

1. Consola de Firebase → Firestore → **TTL** (o Google Cloud Console → Firestore → *Time-to-live*).
2. **Crear política**: grupo de colecciones `quickRooms`, campo `expiresAt`.
3. La política borra la sala, pero no su subcolección `players` (Firestore no borra subcolecciones en cascada, y esas fichas no llevan `expiresAt`). Ocupan muy poco y nadie las lee; si quieres limpiarlas, bórralas desde la consola.

Con la CLI: `gcloud firestore fields ttls update expiresAt --collection-group=quickRooms --enable-ttl --project=trivia-59073`. Firestore borra los documentos caducados en las 24 h siguientes (no es inmediato).

### Límites conocidos

- **Los resultados se calculan en el cliente.** Cada dispositivo declara sus aciertos y fallos; las reglas solo comprueban que cada uno escriba lo suyo, con contadores enteros y acotados, en la ronda actual y mientras la sala está abierta. Un usuario técnico podría inflarlos. Es aceptable para una partida casual sin clasificaciones guardadas.
- **El anfitrión debe dejar su dispositivo abierto**: simula los bots y cierra la partida. Si se va, cada jugador da la partida por terminada al llegar al límite de 5 minutos.
- **El máximo de 20 jugadores lo comprueba la app**: las reglas no pueden contar documentos.
- **Si alguien recarga o cierra la app en mitad de la partida**, queda terminado con lo último que subió; no puede volver a empezar.
- **Con *Terminar ahora***, lo que alguien no hubiera subido en sus últimos 5 s se pierde.
- **El techo de 60 s limita el tiempo restante, no la duración**: quien acierte casi todo muy rápido puede seguir hasta el límite de 5 minutos.
- **El banco tiene 80 preguntas difíciles** (de 280). En rondas muy largas o muchas revanchas seguidas, las difíciles se repiten antes que las normales.

### Pruebas

- `src/game/__tests__/quick.test.ts`: secuencia (semilla, sin repetir, proporción de difíciles por tramo, sin cartas seguidas, no se agota), reloj, desempates, sala y bots.
- `src/services/__tests__/quick.test.ts`: con un Firestore simulado, los servicios solo tocan `quickRooms/**`.
- `tests/rules/quick.int.test.ts`: reglas de `quickRooms` (con `npm run test:rules:emu`).
- `QuickParityTest` (Android): misma secuencia, reloj, ranking y bots que la web con la misma semilla.
- `scripts/e2e/web-rapida.mjs` (web contra el emulador) y `scripts/e2e/android-web-rapida.mjs` + `RapidaCruzadaUiTest` (Android y web en la misma sala).

---

## Arquitectura

```
src/
  config/     gameConfig.ts (puntos y tiempos) · firebase.ts (inicialización)
  data/       questions.json (280 preguntas, empaquetadas con la app)
  game/       lógica pura, sin Firebase: puntos, sorteo de cartas, retos,
              clasificación, títulos, bots, día de temporada (con pruebas)
  services/   única capa que habla con Firebase: auth, users, groups,
              players, answers, challenges, admin
  state/      GameContext (listeners en tiempo real y datos derivados),
              automatización del administrador (bots, cierre de temporada)
  components/ cartas SVG, mazo, avatares, clasificación, UI ornamental
  screens/    pantallas
tests/rules/  prueba de las reglas (emulador local o proyecto real)
```

Las pantallas son las siguientes:
- **Para todos:**
  - Bienvenida (apodo y avatar).
  - Crear o unirse a un grupo, también con el enlace `/unirse/CÓDIGO` del QR.
  - Inicio.
  - Las 3 cartas del día: revelación, comodín, pregunta y resultado.
  - Lanzar un reto; responder o devolver un reto (Rueda de la Fortuna y doble reto).
  - Clasificación y perfil.
  - Ceremonia.
- **Solo administrador:** panel de administrador y modo presentación.

En móvil, la app usa una columna con navegación inferior. En PC usa dos columnas, con la clasificación en vivo a la derecha.

### Modelo de datos

| Documento | Contenido |
|---|---|
| `users/{uid}` | apodo, avatar, `grupoActual` (un grupo a la vez) |
| `groups/{code}` | nombre, adminUid, adminJuega, fechaInicio, dayOffset, estado, temporada, campeón, títulos |
| `groups/{code}/players/{uid}` | apodo, avatar, esBot |
| `groups/{code}/answers/{uid}_{dia}_{n}` | número de carta (0–2), carta, comodín, pregunta (se fija al abrirla), estado (carta/abierta/cerrada), opción, correcta, tiempoMs, retoPara, horas de carta, apertura y respuesta |
| `groups/{code}/challenges/{para}_{dia}` | de, para, día, pregunta, estado (pendiente/devuelto/abierto/resuelto), devueltoEn, respuestaN, correcta, tiempoMs, horas |
| `groups/{code}/challenges/{para}_{dia}_2` | la segunda pregunta del doble reto (`extra: true`); solo cuenta si la devolución falló |

**La clasificación se calcula a partir de eventos.** Los documentos de jugador no guardan puntos. Cada cliente escucha `answers` y `challenges` en tiempo real y calcula la misma clasificación con `computeStandings()`, una función pura y probada.

Así, cada jugador solo escribe sus propios eventos y nadie necesita permiso para modificar los puntos de otro. Sería necesario, por ejemplo, cuando el retado falla y el retador gana +10.

Las claves deterministas hacen el resto:
- `{uid}_{dia}_{n}` (con n = 0, 1, 2) limita a 3 cartas por día; las reglas exigen haber respondido la anterior.
- `{para}_{dia}` impide recibir más de un reto por día.

Las operaciones de varios documentos usan transacciones (crear el grupo con un código único, jugadas de los bots) o escrituras en lote (unirse, lanzar un reto).

### Puntuación (`src/config/gameConfig.ts`)

| Evento | Puntos |
|---|---|
| Acertar una de las 3 cartas del día | +5 |
| …en menos de 8 s | +2 extra |
| Lanzar un reto (se desbloquea uno al día con 2 aciertos) | 0 |
| Ganar un reto (el retado si acierta, el retador si falla) | +10 |
| Fallar una pregunta de reto (o que se acabe el tiempo) | −5 |
| Devolver un reto con éxito (30 %): lo responde el retador | 0 si acierta, −5 si falla |
| Devolución fallida (70 %): doble reto | +10 una vez si acierta alguna, −5 por cada fallo; si falla las dos, el retador gana +10 |

**Comodín:** uno al día. Tras voltear la carta, se puede cambiar por otra de otra categoría antes de ver la pregunta.

**Devolver un reto:** el resultado sale de los milisegundos de la hora del servidor al devolverlo (`ms % 100 < 30`). Nadie puede elegir ese instante, y las reglas aplican la misma cuenta para decidir quién debe responder. La pregunta extra del doble reto se crea en el mismo lote que la devolución, así existe antes de conocer el resultado.

Los puntos pueden quedar en negativo. La racha cuenta aciertos seguidos.

Desempate: más aciertos y, después, menor tiempo promedio de respuesta. El promedio incluye las preguntas falladas, para que nadie gane el desempate fallando rápido.

Las preguntas de reto sin responder al cerrar la temporada cuentan como falladas.

### Uso del plan gratuito (Spark)

Cada escritura (una respuesta o un reto) llega como una lectura a cada dispositivo conectado al grupo. Con 50 personas, 6 bots y la pantalla de presentación durante una semana, el total queda en unos pocos miles de lecturas por día. El límite gratuito es de 50 000 lecturas y 20 000 escrituras diarias.

---

## Seguridad: qué protegen las reglas y qué no

### Lo que sí garantizan las reglas (`firestore.rules`)

- **Acceso:** solo usuarios autenticados. Nadie puede listar grupos, solo consultarlos por código.
- **Lectura:** solo los miembros de un grupo (y su administrador) leen sus jugadores, respuestas y retos.
- **Escritura propia:** cada jugador escribe solo su perfil, su ficha y sus respuestas. Nadie puede marcarse como bot.
- **Administrador:**
  - solo él modifica la configuración del grupo, incluido `dayOffset`, y nunca puede cambiar el dueño;
  - gestiona los bots y borra datos;
  - los retos de los bots solo se pueden **crear**: no pisan un reto que ya exista;
  - solo puede resolver preguntas de reto que le toquen a un bot (recibidas o devueltas).
- **Cartas del día:**
  - cada carta se crea en estado "carta" **con la hora del servidor**, solo para el día actual (calculado en el servidor con `fechaInicio + dayOffset`), como máximo 3 y en orden;
  - el comodín cambia la carta una sola vez en todo el día y solo antes de ver la pregunta;
  - "Ver la pregunta" fija la pregunta y la hora de inicio; se cierra **una sola vez** y sin poder cambiar la pregunta;
  - recargar la página no da una carta nueva.
- **Temporizador:**
  - empieza 3 s después de registrar en el servidor que se abrió la pregunta, lo que dura la cuenta atrás (`pausaRevelacionMs`);
  - el tiempo declarado no puede ser menor que el tiempo real transcurrido, descontando esa pausa y 5 s de margen de red; esto evita reclamar el bonus de rapidez a la fuerza;
  - pasados 35 s solo se acepta "tiempo agotado";
  - recargar la página no reinicia el temporizador.
- **Retos:**
  - un reto solo se lanza desde la respuesta que completó 2 aciertos ese día, así que es uno por jugador y día;
  - solo el retado lo devuelve, antes de abrirlo y una vez; la hora del servidor decide quién lo responde;
  - solo quien debe responder una pregunta de reto la abre y la resuelve, una vez.

### Lo que no se puede blindar sin Cloud Functions

| Limitación | Por qué | Por qué es aceptable aquí |
|---|---|---|
| **Las preguntas y respuestas correctas viajan en la app.** | `questions.json` se empaqueta en el cliente (requisito: no se guarda en Firestore). Alguien técnico podría leerlas en el código JS. | Es una demo de convención sin premios reales. Quien lo haga solo se engaña a sí mismo y queda en evidencia en la clasificación pública. |
| **`correcta` y `tiempoMs` los declara el cliente.** | Validar la respuesta en el servidor requeriría una función con la clave de respuestas. Las reglas solo limitan rangos y tiempos. | Igual que arriba. Las reglas impiden lo grave: responder dos veces, por otros o fuera de tiempo. |
| **La clasificación se calcula en cada cliente.** | No hay un proceso de servidor que sume los puntos. | Todos calculan con los mismos eventos y la misma función, así que ven el mismo resultado. |
| **Los retos obligatorios se exigen en la app, no en las reglas.** | Las reglas no pueden consultar "¿tiene retos pendientes?", porque no admiten consultas. | Un reto sin responder al cerrar la temporada cuenta como fallo igualmente. |
| **Los bots y el cierre de temporada dependen del cliente del administrador.** | Sin Cloud Functions no hay procesos programados. | La PC de la exposición está siempre abierta. |
| **El administrador es de confianza.** | Escribe las respuestas de los bots y controla el día (`dayOffset`). | Es el organizador de la demo. |
| **Identidad anónima por dispositivo.** | Si alguien borra los datos del navegador, pierde su sesión y entra como jugador nuevo. | Sin registro es lo esperado; el apodo se puede repetir. |
| **El código de grupo es la única barrera de entrada.** | 5 caracteres de un alfabeto de 32 (unos 33 millones de combinaciones); no se pueden listar grupos. | Suficiente para una convención. |
| **Partida Rápida: los contadores los declara cada cliente.** | Sin servidor que corrija las respuestas. | No hay premios ni clasificaciones guardadas; ver la sección Partida Rápida. |

### El día de temporada

`día = floor((ahora − fechaInicio) / 24 h) + dayOffset`

`fechaInicio` es la medianoche local del día en que se creó el grupo, en el dispositivo del organizador. La misma fórmula está en `src/game/day.ts` y en las reglas. El cliente corrige el desfase de su reloj con la hora del servidor. En los cambios de horario de verano, el día puede cambiar con una hora de diferencia.

---

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| "Falta configurar Firebase" | No existe `.env` o le falta algún valor. Reinicia `npm run dev` después de crearlo. |
| "El inicio de sesión anónimo no está activado" | Actívalo en Authentication → Método de acceso. |
| "No tienes permiso para hacer eso" al empezar | Las reglas no están desplegadas: ejecuta `npm run deploy:rules`. |
| "Ya sacaste esta carta, o el día cambió" | El administrador avanzó el día mientras jugabas. Recarga la página. |
| Los bots no juegan | La app del administrador debe estar abierta (por ejemplo, en el modo presentación). |
| Tras desplegar, el celular ve la versión vieja | El service worker se actualiza solo. Cierra y vuelve a abrir la app. |
