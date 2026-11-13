package com.triviadeldestino.app

import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.google.mlkit.vision.common.InputImage
import com.triviadeldestino.app.data.Paths
import com.triviadeldestino.app.data.ServerClock
import com.triviadeldestino.app.data.toGroup
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.drawQuestion
import com.triviadeldestino.app.game.elapsedMs
import com.triviadeldestino.app.game.evaluateAnswer
import com.triviadeldestino.app.game.seasonDay
import com.triviadeldestino.app.nativo.ID_NOTIFICACION_RECORDATORIO
import com.triviadeldestino.app.nativo.QrDecoder
import com.triviadeldestino.app.nativo.RecordatorioWorker
import com.triviadeldestino.app.ui.components.joinUrl
import com.triviadeldestino.app.ui.components.qrBitmap
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.random.Random

/** Funciones nativas: lectura de QR con ML Kit y recordatorio diario con WorkManager (Firebase real). */
@RunWith(AndroidJUnit4::class)
class NativoTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val c = (context as TriviaApp).container

    @Test
    fun mlKitLeeElQrDeInvitacionYRechazaOtros() = runBlocking {
        val decoder = QrDecoder()
        // El mismo QR que muestra la tarjeta de invitación (y la presentación web).
        val invitacion = InputImage.fromBitmap(qrBitmap(joinUrl("A7K2Q"), 600), 0)
        assertEquals("A7K2Q", decoder.codigoDeGrupo(invitacion))
        // Un QR cualquiera se lee, pero no es un grupo.
        val otro = InputImage.fromBitmap(qrBitmap("https://example.com/hola", 600), 0)
        assertEquals(listOf("https://example.com/hola"), decoder.textos(otro))
        assertNull(decoder.codigoDeGrupo(otro))
        decoder.cerrar()
    }

    @Test
    fun recordatorioSoloAvisaSiNoHaJugadoHoy() = runBlocking {
        if (Build.VERSION.SDK_INT >= 33) {
            InstrumentationRegistry.getInstrumentation().uiAutomation
                .executeShellCommand("pm grant ${context.packageName} android.permission.POST_NOTIFICATIONS").close()
            delay(500)
        }
        val notificaciones = context.getSystemService(NotificationManager::class.java)
        notificaciones.cancelAll()

        val uid = c.auth.ensureSignedIn()
        c.profiles.save(uid, "Rita Aviso", AvatarId.VELA, null)
        val perfil = c.profiles.watch(uid).first { it.confirmado && it.profile != null }.profile!!
        val code = c.groups.create(perfil, "Prueba recordatorio", juega = true)
        try {
            c.profiles.watch(uid).first { it.confirmado && it.profile?.grupoActual == code }

            // 1) No reveló su carta: el trabajo avisa.
            assertEquals(ListenableWorker.Result.success(), TestListenableWorkerBuilder<RecordatorioWorker>(context).build().doWork())
            assertTrue("debería haber notificación", notificaciones.activeNotifications.any { it.id == ID_NOTIFICACION_RECORDATORIO })
            val texto = notificaciones.activeNotifications.first { it.id == ID_NOTIFICACION_RECORDATORIO }.notification.extras.getString("android.title")
            assertEquals("Tus cartas del día te esperan", texto)
            notificaciones.cancelAll()

            // 2) Juega sus 3 cartas del día: el trabajo ya no avisa.
            val g = c.groups.watch(code).first().toGroup()
            val dia = seasonDay(g.fechaInicioMs, g.dayOffset, ServerClock.now())
            val vistas = HashSet<String>()
            for (n in 0 until GameConfig.DEFAULT.preguntasPorDia) {
                val draw = drawQuestion(c.questions.all, vistas, Random.Default)!!
                vistas += draw.question.id
                c.game.drawCard(code, uid, dia, n, draw.card)
                val abierta = c.game.openQuestion(code, uid, dia, n, draw.question.id)
                delay(3_500)
                c.game.close(code, uid, dia, n, evaluateAnswer(draw.question, 0, elapsedMs(abierta, ServerClock.now()))).await()
            }
            assertEquals(ListenableWorker.Result.success(), TestListenableWorkerBuilder<RecordatorioWorker>(context).build().doWork())
            assertFalse("no debería avisar tras jugar", notificaciones.activeNotifications.any { it.id == ID_NOTIFICACION_RECORDATORIO })
        } finally {
            val db = Firebase.firestore
            runCatching {
                for (sub in listOf("answers", "challenges", "players", "admins")) {
                    db.collection("groups/$code/$sub").get().await().documents.forEach { it.reference.delete().await() }
                }
                db.document(Paths.adminKey(code)).delete().await()
                db.document(Paths.group(code)).delete().await()
            }
            runCatching { Firebase.auth.currentUser?.delete()?.await() }
        }
    }
}
