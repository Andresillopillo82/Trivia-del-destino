package com.triviadeldestino.app

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.triviadeldestino.app.data.Paths
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Prueba de interfaz: recorre la app como un usuario (Compose UI Test) contra el Firebase real.
 * Guarda capturas en Android/data/com.triviadeldestino.app/files/capturas.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class JugadorUiTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    private val container get() = rule.activity.application.let { (it as TriviaApp).container }
    private var codigoCreado: String? = null
    private var n = 0

    private fun captura(nombre: String) {
        rule.waitForIdle()
        val dir = File(rule.activity.getExternalFilesDir(null), "capturas").apply { mkdirs() }
        val bmp = rule.onRoot().captureToImage().asAndroidBitmap()
        File(dir, "%02d-%s.png".format(++n, nombre)).outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun esperarTexto(texto: String, ms: Long = 20_000) =
        rule.waitUntilAtLeastOneExists(hasText(texto, substring = true, ignoreCase = true), ms)

    /** Nombre de la carta volteada en juego (lo anuncia el texto para TalkBack). */
    private fun cartaEnJuego(): String? =
        container.questions.all.map { it.card.nombre }.distinct().firstOrNull { nombre ->
            rule.onAllNodes(hasText("Tu carta: $nombre", substring = true)).fetchSemanticsNodes().isNotEmpty()
        }

    /** "Ver la pregunta", esperar el temporizador y elegir la opción correcta. */
    private fun responderBien(primeraVez: Boolean) {
        rule.onNodeWithText("Ver la pregunta", ignoreCase = true).performScrollTo().performClick()
        rule.waitUntilAtLeastOneExists(hasContentDescription("Quedan", substring = true), 20_000)
        if (primeraVez) captura("pregunta")
        val pregunta = container.questions.all.first { q -> rule.onAllNodes(hasText(q.pregunta)).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText(pregunta.opciones[pregunta.respuestaCorrecta]).performScrollTo().performClick()
    }

    @Test
    fun recorridoCompletoDelJugador() {
        // Bienvenida
        esperarTexto("Tu apodo")
        captura("bienvenida")
        rule.onNode(hasText("Tu apodo")).performTextInput("Ulises UI")
        rule.onNodeWithText("Luna").performClick()
        rule.onNodeWithText("Entrar", ignoreCase = true).performScrollTo().performClick()

        // Crear grupo
        esperarTexto("Crear un grupo")
        captura("unirse-o-crear")
        rule.onNode(hasText("Nombre del grupo")).performScrollTo().performTextInput("Prueba UI Android")
        rule.onNodeWithText("Crear grupo", ignoreCase = true).performScrollTo().performClick()

        // Inicio: el creador ve el código y su clave de administración
        esperarTexto("Tus cartas de hoy")
        codigoCreado = runBlocking {
            container.profiles.watch(Firebase.auth.currentUser!!.uid).first { it.profile?.grupoActual != null }.profile!!.grupoActual
        }
        // El inicio es una lista perezosa: con letra grande la invitación queda abajo, así que se desplaza hasta ella.
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("CLAVE DE ADMINISTRACIÓN", substring = true, ignoreCase = true))
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Revelar mi destino", ignoreCase = true))
        captura("inicio")

        // Carta 1: se voltea, se cambia con el comodín y se responde bien.
        rule.onNodeWithText("Revelar mi destino", ignoreCase = true).performScrollTo().performClick()
        rule.waitUntilAtLeastOneExists(hasText("Ver la pregunta", ignoreCase = true), 20_000)
        val antes = cartaEnJuego()
        captura("carta-volteada")
        rule.onNodeWithText("Usar comodín", ignoreCase = true).performScrollTo().performClick()
        rule.waitUntil(15_000) { cartaEnJuego() != antes }
        rule.onNodeWithText("Usar comodín", ignoreCase = true).assertDoesNotExist()
        captura("tras-comodin")
        responderBien(primeraVez = true)
        esperarTexto("¡El destino te sonríe!")
        rule.onNodeWithText("¡Reto desbloqueado!").assertDoesNotExist()
        captura("resultado-1")

        // Carta 2: ya sin comodín; con el 2.º acierto se desbloquea el reto.
        rule.onNodeWithText("Siguiente carta (2 de 3)", ignoreCase = true).performScrollTo().performClick()
        rule.waitUntilAtLeastOneExists(hasText("Ver la pregunta", ignoreCase = true), 20_000)
        rule.onNodeWithText("Usar comodín", ignoreCase = true).assertDoesNotExist()
        responderBien(primeraVez = false)
        esperarTexto("¡El destino te sonríe!")
        esperarTexto("Reto desbloqueado")
        captura("resultado-2")

        // "Volver al inicio" lleva de verdad al inicio: muestra las cartas jugadas y no la clasificación.
        rule.onNodeWithText("Volver al inicio", ignoreCase = true).performScrollTo().performClick()
        esperarTexto("Sacar carta 3 de 3")
        rule.onNodeWithText("¡El destino te sonríe!").assertDoesNotExist()
        rule.onNode(hasContentDescription("Puesto 1", substring = true)).assertDoesNotExist()
        rule.onNode(hasContentDescription("Carta 1:", substring = true)).assertExists()
        captura("inicio-tras-jugar")

        // Clasificación: aparece primero, con sus puntos
        rule.onNode(hasText("Clasificación") and hasClickAction()).performClick()
        rule.waitUntilAtLeastOneExists(hasContentDescription("Puesto 1: Ulises UI (tú)", substring = true), 10_000)
        captura("clasificacion")

        // Perfil y salir del grupo
        rule.onNode(hasText("Perfil") and hasClickAction()).performClick()
        esperarTexto("Tu perfil")
        captura("perfil")
        rule.onNodeWithText("Salir del grupo", ignoreCase = true).performScrollTo().performClick()
        rule.onNodeWithText("Salir").performClick()
        esperarTexto("Unirme a un grupo")
    }

    @After
    fun limpiar() = runBlocking {
        val code = codigoCreado ?: return@runBlocking
        val db = Firebase.firestore
        runCatching {
            for (sub in listOf("answers", "challenges", "players", "admins")) {
                db.collection("groups/$code/$sub").get().await().documents.forEach { it.reference.delete().await() }
            }
            db.document(Paths.adminKey(code)).delete().await()
            db.document(Paths.group(code)).delete().await()
        }
        runCatching { Firebase.auth.currentUser?.delete()?.await() }
        Unit
    }
}
