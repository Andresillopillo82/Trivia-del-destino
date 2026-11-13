package com.triviadeldestino.app

import android.graphics.Bitmap
import android.util.Log
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.triviadeldestino.app.game.QuickPlayer
import com.triviadeldestino.app.game.playersOfRound
import com.triviadeldestino.app.game.rankQuick
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Partida Rápida entre Android y la web (scripts/e2e/android-web-rapida.mjs, con `-e esperarWeb true`).
 * A) Andrea crea la sala en Android con un bot; Beto juega en la web; revancha; Andrea la cierra.
 * B) Ana crea una sala «Solo pantalla» en la web; Andrea entra con el código y juega.
 * Se coordina con el script por logcat (etiqueta TRIVIA_E2E) y un archivo con el código de la sala B.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class RapidaCruzadaUiTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    private val container get() = (rule.activity.application as TriviaApp).container
    private var n = 0
    private var capturadoJuego = false

    private fun log(msg: String) = Log.i("TRIVIA_E2E", msg)

    private fun captura(nombre: String) {
        rule.waitForIdle()
        val dir = File(rule.activity.getExternalFilesDir(null), "capturas-rapida").apply { mkdirs() }
        val bmp = rule.onRoot().captureToImage().asAndroidBitmap()
        File(dir, "%02d-%s.png".format(++n, nombre)).outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun esperar(texto: String, ms: Long = 30_000) = rule.waitUntilAtLeastOneExists(hasText(texto, substring = true, ignoreCase = true), ms)
    private fun hay(texto: String) = rule.onAllNodes(hasText(texto, substring = true)).fetchSemanticsNodes().isNotEmpty()
    private fun boton(texto: String) = rule.onNode(hasText(texto, ignoreCase = true) and hasClickAction())

    /** Juega hasta que se acaba su reloj; devuelve aciertos, fallos y las preguntas vistas. */
    private fun jugar(acertar: (Int) -> Boolean): Triple<Int, Int, List<String>> {
        rule.waitUntilAtLeastOneExists(hasContentDescription("Quedan", substring = true), 20_000)
        val ids = mutableListOf<String>()
        var bien = 0
        // Termina en la espera ("¡Se acabó tu tiempo!") o, si ya terminaron todos, en los resultados.
        fun fin() = hay("¡Se acabó tu tiempo!") || hay("Tu partida:")
        while (!fin()) {
            val q = container.questions.all.firstOrNull { rule.onAllNodes(hasText(it.pregunta)).fetchSemanticsNodes().isNotEmpty() }
            if (q == null || ids.lastOrNull() == q.id) {
                Thread.sleep(40)
                continue
            }
            if (ids.size == 2 && !capturadoJuego) {
                capturadoJuego = true
                captura("juego")
            }
            val si = acertar(ids.size)
            ids += q.id
            if (si) bien++
            runCatching { rule.onNodeWithText(q.opciones[if (si) q.respuestaCorrecta else (q.respuestaCorrecta + 1) % 4]).performScrollTo().performClick() }
        }
        val texto = rule.onAllNodes(hasText(" · ", substring = true) and hasText(" fallo", substring = true) or hasText("Tu partida:", substring = true))
            .fetchSemanticsNodes().first().config[SemanticsProperties.Text].joinToString { it.text }
        val (c, f) = Regex("\\d+").findAll(texto).map { it.value.toInt() }.toList()
        return Triple(c, f, ids)
    }

    /** Ranking de la ronda (apodo:aciertos:fallos en orden), leído de Firestore. */
    private fun ranking(code: String): String = runBlocking {
        val sala = container.quick.watchRoom(code).first()!!
        val jugadores: List<QuickPlayer> = container.quick.watchPlayers(code).first()
        rankQuick(playersOfRound(sala, jugadores)).joinToString("|") { "${it.player.apodo}:${it.player.correctas}:${it.player.falladas}" }
    }

    private fun codigoEnPantalla(): String {
        rule.waitUntilAtLeastOneExists(hasContentDescription("Código: ", substring = true), 20_000)
        val desc = rule.onAllNodes(hasContentDescription("Código: ", substring = true)).fetchSemanticsNodes().first()
            .config[SemanticsProperties.ContentDescription].first()
        return desc.removePrefix("Código: ").replace(" ", "")
    }

    /** Pulsa «Iniciar» cuando se habilita (tras la revancha, cuando todos volvieron a la ronda). */
    private fun iniciar(nombreCaptura: String) {
        val listo = hasText("Iniciar", ignoreCase = true) and hasClickAction() and isEnabled()
        runCatching { rule.waitUntilAtLeastOneExists(listo, 20_000) }.onFailure { captura("$nombreCaptura-sin-iniciar"); throw it }
        captura(nombreCaptura)
        rule.onNode(listo).performScrollTo().performClick()
    }

    /** Espera a que el script web escriba `marca` en el archivo de señales. */
    private fun esperarWeb(archivo: File, marca: String) {
        val fin = System.currentTimeMillis() + 240_000
        while (System.currentTimeMillis() < fin) {
            if (archivo.exists() && archivo.readText().contains(marca)) return
            Thread.sleep(500)
        }
        error("La web no llegó a $marca")
    }

    @After
    fun limpiar() {
        runCatching { Firebase.auth.currentUser?.delete() }
    }

    @Test
    fun rapidaConLaWeb() {
        assumeTrue("Solo en la prueba cruzada (-e esperarWeb true)", InstrumentationRegistry.getArguments().getString("esperarWeb") == "true")
        val archivo = File(rule.activity.getExternalFilesDir(null), "rapida_code.txt").apply { delete() }
        val senales = File(rule.activity.getExternalFilesDir(null), "rapida_senales.txt").apply { delete() }

        esperar("Tu apodo")
        rule.onNode(hasText("Tu apodo")).performTextInput("Andrea Android")
        rule.onNodeWithText("Luna").performClick()
        rule.onNodeWithText("Entrar", ignoreCase = true).performScrollTo().performClick()
        esperar("Crear un grupo")
        captura("inicio-sin-grupo")
        boton("Crear sala o unirme").performScrollTo().performClick()

        // ---- A) sala creada en Android ----
        esperar("Unirme con código")
        captura("menu")
        boton("Crear sala").performScrollTo().performClick()
        val code = codigoEnPantalla()
        log("RAPIDA_CODIGO=$code")
        esperar("2 jugadores en la sala", 240_000)
        boton("Añadir bot (0/6)").performScrollTo().performClick()
        esperar("3 jugadores en la sala")
        captura("lobby")
        iniciar("lobby-listo")
        runCatching { rule.waitUntilAtLeastOneExists(hasContentDescription("La partida empieza en", substring = true), 15_000) }
            .onFailure { captura("sin-cuenta-atras"); throw it }
        captura("cuenta-atras")
        val (c1, f1, ids1) = jugar { it % 3 == 0 }
        captura("fin-de-mi-tiempo")
        log("ANDROID_FIN c=$c1 f=$f1 ids=${ids1.joinToString(",")}")
        // Cuando solo queda el bot, el anfitrión termina la partida.
        // (Si el bot ya terminó, la partida se cierra sola.)
        rule.waitUntil(180_000) { hay("1 jugador sigue jugando") || rule.onAllNodes(hasContentDescription("Podio")).fetchSemanticsNodes().isNotEmpty() }
        if (hay("1 jugador sigue jugando")) {
            captura("espera-anfitrion")
            boton("Terminar ahora").performScrollTo().performClick()
        }
        rule.waitUntilAtLeastOneExists(hasContentDescription("Podio"), 20_000)
        captura("resultados")
        log("ANDROID_RANKING=${ranking(code)}")
        esperarWeb(senales, "RONDA1_OK")

        // Revancha sin el bot: termina sola cuando los dos terminan.
        boton("Revancha").performScrollTo().performClick()
        esperar("jugadores en la sala")
        rule.onNode(hasContentDescription("Sacar a Oráculo Ónix")).performScrollTo().performClick()
        esperar("2 jugadores en la sala")
        log("ANDROID_REVANCHA")
        iniciar("lobby-revancha")
        val (c2, f2, ids2) = jugar { false }
        log("ANDROID_FIN2 c=$c2 f=$f2 ids=${ids2.joinToString(",")}")
        rule.waitUntilAtLeastOneExists(hasContentDescription("Podio"), 120_000)
        captura("resultados-revancha")
        log("ANDROID_RANKING2=${ranking(code)}")
        esperarWeb(senales, "RONDA2_OK")
        boton("Cerrar sala").performScrollTo().performClick()
        esperar("¿Cerrar la sala?")
        rule.onAllNodes(hasText("Cerrar sala") and hasClickAction()).onLast().performClick()
        esperar("Unirme con código")
        log("ANDROID_CERRADA")

        // ---- B) sala creada en la web («Solo pantalla»): Andrea entra con el código ----
        val fin = System.currentTimeMillis() + 240_000
        while (!archivo.exists() && System.currentTimeMillis() < fin) Thread.sleep(500)
        val code2 = archivo.readText().trim()
        rule.onNode(hasText("Código de la sala")).performScrollTo().performTextInput(code2.lowercase())
        boton("Unirme").performScrollTo().performClick()
        esperar("Estás dentro")
        captura("lobby-invitada")
        log("ANDROID_DENTRO")
        val (c3, f3, ids3) = jugar { it < 2 }
        log("ANDROID_FIN3 c=$c3 f=$f3 ids=${ids3.joinToString(",")}")
        rule.waitUntilAtLeastOneExists(hasContentDescription("Podio"), 120_000)
        captura("resultados-invitada")
        log("ANDROID_RANKING3=${ranking(code2)}")
        esperar("La sala se cerró", 120_000)
        log("ANDROID_TODO_OK")
    }
}
