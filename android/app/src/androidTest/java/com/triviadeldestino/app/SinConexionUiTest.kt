package com.triviadeldestino.app

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Sin conexión: la app avisa, sigue mostrando los datos en caché de Firestore
 * y no deja revelar la carta (la regla de tiempo necesita la hora del servidor).
 * Activa y desactiva el modo avión del dispositivo con UiAutomation.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class SinConexionUiTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    private val container get() = (rule.activity.application as TriviaApp).container
    private var codigoCreado: String? = null
    private var n = 0

    private fun modoAvion(activo: Boolean) {
        val accion = if (activo) "enable" else "disable"
        InstrumentationRegistry.getInstrumentation().uiAutomation
            .executeShellCommand("cmd connectivity airplane-mode $accion")
            // Leer la salida hasta el final espera a que el comando termine.
            .let { android.os.ParcelFileDescriptor.AutoCloseInputStream(it).use { s -> s.readBytes() } }
    }

    private fun captura(nombre: String) {
        rule.waitForIdle()
        val dir = File(rule.activity.getExternalFilesDir(null), "capturas-sin-conexion").apply { mkdirs() }
        val bmp = rule.onRoot().captureToImage().asAndroidBitmap()
        File(dir, "%02d-%s.png".format(++n, nombre)).outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun esperarTexto(texto: String, ms: Long = 20_000) =
        rule.waitUntilAtLeastOneExists(hasText(texto, substring = true, ignoreCase = true), ms)

    @Test
    fun sinConexionMuestraAvisoYBloqueaLaCarta() {
        esperarTexto("Tu apodo")
        rule.onNode(hasText("Tu apodo")).performTextInput("Olga Offline")
        rule.onNodeWithText("Luna").performClick()
        rule.onNodeWithText("Entrar", ignoreCase = true).performScrollTo().performClick()
        esperarTexto("Crear un grupo")
        rule.onNode(hasText("Nombre del grupo")).performScrollTo().performTextInput("Prueba sin red")
        rule.onNodeWithText("Crear grupo", ignoreCase = true).performScrollTo().performClick()
        esperarTexto("Tus cartas de hoy")
        codigoCreado = runBlocking {
            container.profiles.watch(Firebase.auth.currentUser!!.uid).first { it.profile?.grupoActual != null }.profile!!.grupoActual
        }

        // Se corta la red: aparece el aviso y el botón de la carta queda deshabilitado.
        modoAvion(true)
        esperarTexto("Sin conexión a internet")
        rule.onNode(hasText("Sin conexión", ignoreCase = true)).performScrollTo().assertIsNotEnabled()
        captura("inicio-sin-red")

        // La clasificación sigue disponible desde la caché local.
        rule.onNode(hasText("Clasificación") and hasClickAction()).performClick()
        rule.waitUntilAtLeastOneExists(hasContentDescription("Puesto 1: Olga Offline (tú)", substring = true), 10_000)
        esperarTexto("Sin conexión a internet")
        captura("clasificacion-sin-red")

        // Vuelve la red: el aviso desaparece y se puede revelar otra vez.
        modoAvion(false)
        rule.waitUntil(30_000) {
            rule.onAllNodes(hasText("Sin conexión a internet", substring = true)).fetchSemanticsNodes().isEmpty()
        }
        rule.onNode(hasText("Inicio") and hasClickAction()).performClick()
        esperarTexto("Revelar mi destino")
        rule.onNodeWithText("Revelar mi destino", ignoreCase = true).performScrollTo().assertIsEnabled()
        captura("inicio-con-red")
    }

    @After
    fun limpiar() = runBlocking {
        modoAvion(false)
        val code = codigoCreado ?: return@runBlocking
        // Esperar a que vuelva la red antes de borrar.
        Thread.sleep(3_000)
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
