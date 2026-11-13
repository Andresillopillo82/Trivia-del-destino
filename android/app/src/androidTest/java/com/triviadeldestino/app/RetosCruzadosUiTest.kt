package com.triviadeldestino.app

import android.graphics.Bitmap
import android.util.Log
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.triviadeldestino.app.data.Paths
import com.triviadeldestino.app.data.ServerClock
import com.triviadeldestino.app.data.toGroup
import com.triviadeldestino.app.game.computeStandings
import com.triviadeldestino.app.game.isSeasonOver
import com.triviadeldestino.app.game.seasonDay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Retos y ceremonia desde la interfaz Android, con un jugador y una organizadora web reales.
 * Se ejecuta con `-e esperarWeb true` junto con el script web (ver README); sin ese argumento se omite.
 * Se coordina con el script escribiendo marcas en logcat (etiqueta TRIVIA_E2E).
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class RetosCruzadosUiTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    private val container get() = (rule.activity.application as TriviaApp).container
    private var code: String? = null
    private var n = 0

    private fun log(msg: String) = Log.i("TRIVIA_E2E", msg)

    private fun captura(nombre: String) {
        rule.waitForIdle()
        val dir = File(rule.activity.getExternalFilesDir(null), "capturas-retos").apply { mkdirs() }
        val bmp = rule.onRoot().captureToImage().asAndroidBitmap()
        File(dir, "%02d-%s.png".format(++n, nombre)).outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun esperar(texto: String, ms: Long = 30_000) = rule.waitUntilAtLeastOneExists(hasText(texto, substring = true, ignoreCase = true), ms)

    /** Responde mal la pregunta en pantalla. */
    private fun responderMal() {
        rule.waitUntilAtLeastOneExists(hasContentDescription("Quedan", substring = true), 20_000)
        val q = container.questions.all.first { rule.onAllNodes(hasText(it.pregunta)).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText(q.opciones[(q.respuestaCorrecta + 1) % 4]).performClick()
    }

    /** Responde la pregunta en pantalla con la opción correcta (la busca en el banco). */
    private fun responderBien() {
        rule.waitUntilAtLeastOneExists(hasContentDescription("Quedan", substring = true), 20_000)
        val q = container.questions.all.first { rule.onAllNodes(hasText(it.pregunta)).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText(q.opciones[q.respuestaCorrecta]).performClick()
    }

    @Test
    fun retosYCeremoniaConLaWeb() {
        assumeTrue("Solo en la prueba cruzada (-e esperarWeb true)", InstrumentationRegistry.getArguments().getString("esperarWeb") == "true")

        esperar("Tu apodo")
        rule.onNode(hasText("Tu apodo")).performTextInput("Andrea Android")
        rule.onNodeWithText("Luna").performClick()
        rule.onNodeWithText("Entrar", ignoreCase = true).performScrollTo().performClick()
        esperar("Crear un grupo")
        rule.onNode(hasText("Nombre del grupo")).performScrollTo().performTextInput("Retos Android y web")
        rule.onNodeWithText("Crear grupo", ignoreCase = true).performScrollTo().performClick()
        esperar("Tus cartas de hoy")

        val uid = Firebase.auth.currentUser!!.uid
        code = runBlocking { container.profiles.watch(uid).first { it.profile?.grupoActual != null }.profile!!.grupoActual }
        val clave = runBlocking { container.groups.adminKey(code!!) }
        log("CODIGO=$code CLAVE=$clave")

        // Dos cartas acertadas: se desbloquea el reto del día
        rule.onNodeWithText("Revelar mi destino", ignoreCase = true).performClick()
        esperar("Ver la pregunta")
        rule.onNodeWithText("Ver la pregunta", ignoreCase = true).performScrollTo().performClick()
        responderBien()
        esperar("Siguiente carta (2 de 3)")
        rule.onNodeWithText("Siguiente carta (2 de 3)", ignoreCase = true).performScrollTo().performClick()
        esperar("Ver la pregunta")
        rule.onNodeWithText("Ver la pregunta", ignoreCase = true).performScrollTo().performClick()
        responderBien()
        esperar("Reto desbloqueado")
        log("ANDROID_JUGO")

        // Esperar a Beto (web) y retarlo desde la interfaz
        runBlocking { container.game.players(code!!).first { it.size >= 2 } }
        rule.onNodeWithText("Lanzar un reto", ignoreCase = true).performScrollTo().performClick()
        esperar("Lanza tu reto")
        rule.waitUntilAtLeastOneExists(hasText("Beto Web", substring = true), 30_000)
        rule.onNode(hasText("Beto Web", substring = true) and hasClickAction()).performClick()
        captura("elegir-retado")
        rule.onNodeWithText("Retar a Beto Web", ignoreCase = true).performScrollTo().performClick()
        esperar("Reto lanzado a Beto Web")
        captura("reto-lanzado")
        log("ANDROID_RETO_ENVIADO")

        // El reto de Beto llega en tiempo real: aviso en todas las pantallas. Andrea lo devuelve.
        esperar("te lanzó un reto", ms = 240_000)
        captura("aviso-de-reto")
        rule.onNode(hasText("te lanzó un reto", substring = true) and hasClickAction()).performClick()
        esperar("Devolver el reto")
        captura("carta-de-reto")
        rule.onNodeWithText("Devolver el reto", ignoreCase = true).performScrollTo().performClick()
        rule.waitUntilAtLeastOneExists(hasText("La fortuna te", substring = true), 30_000)
        val exito = rule.onAllNodes(hasText("¡La fortuna te sonríe!")).fetchSemanticsNodes().isNotEmpty()
        captura("rueda-${if (exito) "exito" else "fallo"}")
        log("ANDROID_DEVOLVIO exito=$exito")
        if (exito) {
            // El reto vuelve a Beto: lo responde en la web.
            rule.onNodeWithText("Volver al inicio", ignoreCase = true).performScrollTo().performClick()
        } else {
            // Doble reto: acierta la 1.ª y falla la 2.ª (+10 una vez y −5).
            rule.onNodeWithText("Empezar el doble reto", ignoreCase = true).performScrollTo().performClick()
            esperar("pregunta 1 de 2")
            rule.onNodeWithText("Ver la pregunta", ignoreCase = true).performScrollTo().performClick()
            responderBien()
            esperar("¡Venciste el reto!")
            rule.onNodeWithText("Siguiente pregunta", ignoreCase = true).performScrollTo().performClick()
            esperar("pregunta 2 de 2")
            rule.onNodeWithText("Ver la pregunta", ignoreCase = true).performScrollTo().performClick()
            responderMal()
            esperar("Doble reto terminado")
            captura("doble-reto")
        }
        log("ANDROID_RETO_RESPONDIDO")

        // Dani (web) salta al final de la semana: la app lleva sola a la ceremonia
        esperar("es el Dueño del Destino", ms = 240_000)
        rule.mainClock.advanceTimeBy(3_000)
        captura("ceremonia")
        val filas = runBlocking {
            val g = container.groups.watch(code!!).first().toGroup()
            val dia = seasonDay(g.fechaInicioMs, g.dayOffset, ServerClock.now())
            computeStandings(
                container.game.players(code!!).first(), container.game.answers(code!!).first(), container.game.challenges(code!!).first(),
                isSeasonOver(dia) || g.finalizado,
            )
        }
        log("CLASIFICACION_ANDROID=" + filas.joinToString { "${it.apodo}:${it.puntos}" })
        // Margen para que el script web compare antes de borrar el grupo.
        Thread.sleep(15_000)
    }

    @After
    fun limpiar() = runBlocking {
        val c = code ?: return@runBlocking
        val db = Firebase.firestore
        runCatching {
            for (sub in listOf("answers", "challenges", "players", "admins")) {
                db.collection("groups/$c/$sub").get().await().documents.forEach { it.reference.delete().await() }
            }
            db.document(Paths.adminKey(c)).delete().await()
            db.document(Paths.group(c)).delete().await()
            log("LIMPIEZA_OK")
        }.onFailure { log("LIMPIEZA_FALLO ${it.message}") }
        runCatching { Firebase.auth.currentUser?.delete()?.await() }
        Unit
    }
}
