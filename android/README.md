# Trivia del Destino · App Android

App nativa en **Kotlin + Jetpack Compose** del juego Trivia del Destino. Comparte con la web
(carpeta raíz del repositorio) el mismo proyecto de Firebase, las mismas reglas de Firestore y el
mismo banco de preguntas, así que un jugador en Android y otro en la web juegan en el mismo grupo.

**Qué hace la app**

- **Jugar:** perfil, crear o unirse a un grupo, las 3 cartas del día (con un comodín para cambiar
  la carta), la pregunta con temporizador, retos (que se pueden devolver con la Rueda de la Fortuna),
  clasificación y ceremonia final. Las reglas completas están en el README de la raíz.
- **Partida Rápida:** salas temporales por código, sin grupo: 45 s contrarreloj (+2 s por acierto,
  −2 s por fallo) con las mismas preguntas para todos, bots, revancha y modo «Solo pantalla». Web y
  Android juegan en la misma sala (`ui/quick/`, `game/Quick.kt`, `data/QuickRepository.kt`).
- **Funciones nativas:**
  - escanear el QR con CameraX + ML Kit;
  - recordatorio diario con WorkManager;
  - vibración y sonido;
  - enlaces `https://trivia-59073.web.app/unirse/CÓDIGO` y `/rapida/CÓDIGO` que abren la app (App Links).
- **Administrar el grupo:** queda en la web a propósito (simular días, bots, cerrar la temporada).
  Quien crea el grupo desde Android recibe una **clave de administración** para entrar como
  organizador en la web.

---

## 1. Abrir y ejecutar en Android Studio

**Requisitos:** Android Studio reciente (trae su propio JDK) y un emulador o un teléfono con Android 8.0 o superior.

1. Copia `google-services.json` (consola de Firebase → Configuración del proyecto → app Android
   `com.triviadeldestino.app`) en `android/app/`. No se sube al repositorio.
2. En Android Studio: **File → Open** y elige la carpeta **`android/`** (no la raíz del repositorio).
3. Espera a que termine **Gradle Sync**. La primera vez descarga dependencias y tarda unos minutos.
4. Elige un dispositivo arriba (emulador de **Device Manager** o teléfono con depuración USB) y pulsa **Run ▶**.

Las preguntas no se copian a mano: la tarea `copiarPreguntas` del build lleva
`../src/data/questions.json` a los assets en cada compilación, así web y app usan siempre el mismo archivo.

Desde la terminal, en `android/`:

```bash
./gradlew :app:installDebug            # compila e instala la versión debug
./gradlew :app:testDebugUnitTest       # pruebas unitarias (sin dispositivo)
```

---

## 2. Arquitectura

MVVM con cuatro capas. Cada capa solo conoce a las de abajo:

```
ui/       Pantallas Compose  ──observa──▶  GameViewModel (StateFlow<GameUiState>)
                                                   │ llama
data/     Repositorios (Auth, Perfil, Grupo, Juego) ── Firebase Auth anónimo + Firestore
                                                   │ usa
game/     Reglas puras en Kotlin: puntos, día de temporada, retos, clasificación, títulos
nativo/   Cámara/QR, recordatorio, vibración y sonido, ajustes
```

| Carpeta | Contenido | Por qué así |
|---|---|---|
| `game/` | `Rules.kt`, `Standings.kt`, `Model.kt`, `Cards.kt`, `Questions.kt` | Kotlin puro, sin Android: se prueba con JUnit en milisegundos y se compara con la web (ver *ParityTest*). |
| `data/` | `Repositories.kt`, `Docs.kt`, `Support.kt` | Traduce Firestore a flujos (`callbackFlow`) y escribe los mismos documentos que la web (`Docs.kt` es el espejo de `src/services/docs.ts`). |
| `ui/` | `GameViewModel`, `TriviaRoot` (navegación), `screens/`, `cards/`, `components/`, `theme/` | Un único `StateFlow<GameUiState>`: la interfaz es una función del estado y sobrevive a rotaciones. |
| `nativo/` | `QrScanner.kt`, `Recordatorio.kt`, `Efectos.kt`, `Ajustes.kt` | Lo que solo puede hacer una app nativa, aislado del resto. |

**Decisiones principales**

- **La puntuación se calcula a partir de eventos.** La clasificación no se guarda: se calcula en
  el dispositivo a partir de las respuestas y los retos, igual que en la web. Así nadie puede
  escribirse puntos a mano. Las reglas de Firestore validan cada evento, incluido el tiempo de
  respuesta con la hora del servidor.
- **Inyección de dependencias manual.** `TriviaApp` crea un `AppContainer` con los repositorios
  y el `ViewModel` los recibe por su `Factory`. Para una app de este tamaño, Hilt añadiría
  complejidad sin aportar nada que se note.
- **Navegación con rutas tipadas.** Las rutas son clases `@Serializable` (`Inicio`, `Jugar`,
  `Reto(id)`…), así que los argumentos los comprueba el compilador. "Volver al inicio" hace
  `popBackStack(Inicio)` para quitar de la pila la pregunta o el reto.
- **Funciona sin conexión.** Firestore guarda en caché los últimos datos. Sin red aparece un
  aviso y se puede consultar la clasificación, pero no se puede sacar una carta, porque la
  regla de tiempo necesita la hora del servidor.
- **Accesibilidad.**
  - Descripciones para TalkBack.
  - Se respeta "Quitar animaciones" (`LocalReduceMotion`).
  - Se probó con letra al 200 %: las pestañas y la cabecera reducen el texto en lugar de partirlo.
- **Arte vectorial.** Las cartas y avatares se exportan de la web como VectorDrawable con
  `scripts/export-android-art.mjs`, que usa el mismo conversor que Android Studio. Los sonidos
  son originales, generados por síntesis con `scripts/generate-android-sounds.mjs`.

---

## 3. Funciones nativas y cómo probarlas

| Función | Implementación | Cómo probarla |
|---|---|---|
| Escanear QR | CameraX + ML Kit (en el dispositivo, sin red), con explicación previa del permiso | En un teléfono real: **Unirme a un grupo → Escanear QR** y apunta al QR de la web. En el emulador con ventana: **Extended controls → Camera → Wall poster** con la imagen del QR. |
| Recordatorio diario | `RecordatorioWorker` de WorkManager a las 19:00; avisa solo si ese día aún te quedan cartas por jugar | **Perfil → Sonido y avisos → Recordatorio diario**. En Android 13 o superior pide permiso de notificaciones. |
| Vibración y sonido | `SoundPool`: sonido al voltear la carta, en los últimos 5 s, al acertar o fallar y en la ceremonia. `performHapticFeedback`: vibración al acertar, al fallar y en los últimos segundos | **Perfil → Sonido y avisos**, interruptores *Sonido* y *Vibración*. |
| App Links | `intent-filter` con `autoVerify` para `/unirse/`; la web publica `/.well-known/assetlinks.json` | Abre `https://trivia-59073.web.app/unirse/CÓDIGO` desde el teléfono: se abre la app con el código listo. |

`assetlinks.json` lista dos huellas SHA-256: la del certificado debug de la máquina donde se
desarrolló y la del certificado release. Con un certificado debug de otra máquina, el enlace
abre la web en lugar de la app hasta que se añada su huella.

---

## 4. Pruebas

**Unitarias** (`app/src/test`, 38 pruebas, sin dispositivo): `./gradlew :app:testDebugUnitTest`

- `RulesTest`, `StandingsTest` y `RecordatorioTest` cubren las reglas del juego y el horario del aviso.
- `ParityTest` comprueba que Kotlin y la web dan **el mismo resultado**. Usa 60 escenarios de
  clasificación (con cartas sin abrir, devoluciones con los dos resultados y dobles retos), 40 de
  cambio de día y 200 horas de devolución, generados con la lógica TypeScript
  (`node scripts/export-parity-fixture.mjs`). También compara qué retos bloquean a cada jugador y
  quién puede retar. Si alguien cambia una regla en un solo lado, esta prueba falla.
- `QuickParityTest` hace lo mismo con la Partida Rápida: misma secuencia de preguntas con la misma
  semilla (generador mulberry32 portado bit a bit), mismo reloj, mismo ranking y mismos bots.

**Instrumentadas** (`app/src/androidTest`, en emulador o teléfono, contra el Firebase real).
Cada prueba borra el grupo que crea.

| Prueba | Qué verifica |
|---|---|
| `JugadorUiTest` | Recorrido completo con Compose UI Test: perfil, crear grupo, carta 1 con comodín, carta 2 (sin comodín) y reto desbloqueado, volver al inicio, clasificación, perfil y salir. Pasa con letra al 100 % y al 200 %. Guarda capturas. |
| `SinConexionUiTest` | Activa el modo avión: aparece el aviso, la carta queda bloqueada, la clasificación sigue visible y todo vuelve al reconectar. |
| `EnlaceUiTest` | Un enlace `/unirse/CÓDIGO` lleva a la pantalla de unirse con el código rellenado. |
| `NativoTest` | ML Kit lee el QR de invitación y rechaza otros; el worker notifica solo si no jugaste. |
| `FirebaseIntegracionTest` | Capa de datos contra Firestore y sus reglas. |
| `RapidaCruzadaUiTest` | Partida Rápida con la web: Android crea la sala con un bot y un jugador web; ambos ven las mismas preguntas y el mismo ranking; revancha; luego Android entra en una sala «Solo pantalla» creada en la web. Con `node scripts/e2e/android-web-rapida.mjs`. |
| `RetosCruzadosUiTest` | Retos con jugadores web reales: Android reta, responde y **devuelve** un reto; según la Rueda de la Fortuna, el reto vuelve a la web o Android juega el doble reto. Termina con la ceremonia (ver abajo). Sin `-e esperarWeb true` se omite. |

```bash
./gradlew :app:connectedDebugAndroidTest
# Una sola clase:
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.triviadeldestino.app.JugadorUiTest
```

Para probar con letra grande: `adb shell settings put system font_scale 2.0`. Vuelve a
`1.0` al terminar.

**Pruebas cruzadas Android ↔ web.** Una prueba instrumentada juega en el emulador mientras un
script de Playwright juega en la web, y al final ambos lados deben mostrar la misma clasificación.
Se coordinan con mensajes en logcat (etiqueta `TRIVIA_E2E`).

1. Ten el emulador encendido.
2. Instala la app y su APK de pruebas: `./gradlew :app:installDebug :app:installDebugAndroidTest`.
3. En la raíz del repositorio, arranca la web con `npm run dev`.
4. Lanza uno de los scripts:

```bash
node scripts/e2e/android-web-datos.mjs   # FirebaseIntegracionTest + jugador y organizadora web
node scripts/e2e/android-web-retos.mjs   # RetosCruzadosUiTest: retos cruzados, devolución y ceremonia
```

Los scripts usan Chrome instalado (`playwright-core` con `channel: 'chrome'`).

---

## 5. Versión release firmada

La versión release se reduce con **R8** (código y recursos) y se firma con un certificado propio.

1. Crea el almacén de claves una sola vez. Está en `.gitignore`.

   ```bash
   keytool -genkeypair -keystore keystore/trivia-release.jks -storetype PKCS12 \
     -alias trivia -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Crea `android/keystore.properties`. También está en `.gitignore`.

   ```properties
   storeFile=keystore/trivia-release.jks
   storePassword=…
   keyAlias=trivia
   keyPassword=…
   ```

3. Compila: `./gradlew :app:assembleRelease`. El resultado queda en
   `app/build/outputs/apk/release/app-release.apk`. En Android Studio también sirve
   **Build → Generate Signed App Bundle / APK**.

Sin `keystore.properties` el proyecto compila igual, pero la APK release sale sin firmar.
**Guarda una copia del `.jks` y de las contraseñas fuera del ordenador.** Si se pierden, no se
puede publicar una actualización con la misma firma.

Si cambias de certificado, saca su huella con
`keytool -list -v -keystore keystore/trivia-release.jks`, añádela a
`public/.well-known/assetlinks.json` en la raíz y despliega con `npm run deploy`.

Para pasar de debug a release en el mismo dispositivo hay que desinstalar primero, porque las
firmas son distintas: `adb uninstall com.triviadeldestino.app`.

---

## 6. Flujo con la web (administración)

1. Desde Android, **Crear grupo**. La app muestra el código, el QR y la **clave de
   administración**. Mientras el grupo está vacío aparecen en Inicio; después, en Perfil.
2. En la web: **Administrar un grupo** → código + clave. Esa persona queda como co-organizadora
   y puede simular días, añadir bots, cerrar la temporada o borrar el grupo.
3. Los jugadores se unen desde Android (QR, enlace o código) o desde la web. Todos ven la misma
   clasificación en vivo.

---

## 7. Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `File google-services.json is missing` | Falta el paso 1 de la sección 1. |
| `SDK location not found` | Android Studio crea `local.properties` al abrir el proyecto. Desde la terminal: `sdk.dir=C\:/Users/<usuario>/AppData/Local/Android/Sdk` (con barras normales). |
| El emulador dice "Not enough space" | En Device Manager → Edit → Advanced, sube *Internal Storage* a 2 GB o más. |
| La cámara del emulador se ve negra | El emulador sin ventana no tiene escena virtual. Usa el emulador con ventana o un teléfono. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Hay instalada una versión con otra firma (debug ↔ release): `adb uninstall com.triviadeldestino.app`. |
| "Sin conexión" aunque haya red | El emulador a veces pierde la red al despertar. Activa y desactiva el modo avión. |
