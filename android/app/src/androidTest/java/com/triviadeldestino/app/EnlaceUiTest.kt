package com.triviadeldestino.app

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Abrir la app desde un enlace de invitación deja el código listo para unirse. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class EnlaceUiTest {
    @get:Rule
    val rule = createEmptyComposeRule()

    @Test
    fun enlaceDeInvitacionPrellenaElCodigo() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://trivia-59073.web.app/unirse/K7M2Q"))
            .setClass(ApplicationProvider.getApplicationContext(), MainActivity::class.java)
        ActivityScenario.launch<MainActivity>(intent).use {
            rule.waitUntilAtLeastOneExists(hasText("Tu apodo"), 20_000)
            rule.onNode(hasText("Tu apodo")).performTextInput("Elena Enlace")
            rule.onNodeWithText("Entrar", ignoreCase = true).performScrollTo().performClick()
            // Tras crear el perfil, la pantalla de unirse muestra el código del enlace.
            rule.waitUntilAtLeastOneExists(hasText("Unirme a un grupo"), 20_000)
            rule.waitUntilAtLeastOneExists(hasText("K7M2Q"), 5_000)
        }
    }

    @After
    fun limpiar() = runBlocking {
        runCatching { Firebase.auth.currentUser?.delete()?.await() }
        Unit
    }
}
