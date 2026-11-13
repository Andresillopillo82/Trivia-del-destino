package com.triviadeldestino.app

import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.triviadeldestino.app.data.GameException
import com.triviadeldestino.app.data.Paths
import com.triviadeldestino.app.data.ServerClock
import com.triviadeldestino.app.data.toGroup
import com.triviadeldestino.app.game.AnswerState
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.ChallengeState
import com.triviadeldestino.app.game.challengeId
import com.triviadeldestino.app.game.computeStandings
import com.triviadeldestino.app.game.drawQuestion
import com.triviadeldestino.app.game.elapsedMs
import com.triviadeldestino.app.game.evaluateAnswer
import com.triviadeldestino.app.game.pickChallengeQuestion
import com.triviadeldestino.app.game.seasonDay
import com.triviadeldestino.app.game.seenQuestionIds
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.random.Random

/**
 * Prueba de integración contra el Firebase real, dentro del emulador o del teléfono.
 * Comprueba que los documentos que escribe Android cumplen firestore.rules y que la app
 * comparte grupo con la web.
 *
 * Modo cruzado (con un jugador web real, ver README): `-e esperarWeb true`.
 * Escribe en logcat (etiqueta TRIVIA_E2E) el código y la clave del grupo para el script web.
 */
@RunWith(AndroidJUnit4::class)
class FirebaseIntegracionTest {
    private val c = ApplicationProvider.getApplicationContext<TriviaApp>().container
    private val esperarWeb = InstrumentationRegistry.getArguments().getString("esperarWeb") == "true"

    private fun log(msg: String) = Log.i("TRIVIA_E2E", msg)

    @Test
    fun flujoDelJugadorConFirebaseReal() = runBlocking {
        val uid = c.auth.ensureSignedIn()
        c.profiles.save(uid, "Andrea Android", AvatarId.LUNA, null)
        val perfil = c.profiles.watch(uid).first { it.confirmado && it.profile != null }.profile!!

        // Crear grupo desde Android (con su clave de administración para la web).
        val code = c.groups.create(perfil, "Prueba Android y web", juega = true)
        val clave = c.groups.adminKey(code)
        assertEquals("la creadora lee la clave", 8, clave?.length)
        log("CODIGO=$code CLAVE=$clave")

        try {
            c.profiles.watch(uid).first { it.confirmado && it.profile?.grupoActual == code }
            val grupo = c.groups.watch(code).first().toGroup()
            val dia = seasonDay(grupo.fechaInicioMs, grupo.dayOffset, ServerClock.now())

            // Dos cartas del día: voltear, ver la pregunta, esperar la cuenta atrás y responder bien.
            val vistas = HashSet<String>()
            val cartas = (0..1).map { n ->
                val draw = drawQuestion(c.questions.all, vistas, Random.Default)!!
                vistas += draw.question.id
                c.game.drawCard(code, uid, dia, n, draw.card)
                val abiertaEn = c.game.openQuestion(code, uid, dia, n, draw.question.id)
                delay(3_600)
                val resultado = evaluateAnswer(draw.question, draw.question.respuestaCorrecta, elapsedMs(abiertaEn, ServerClock.now()))
                withTimeout(12_000) { c.game.close(code, uid, dia, n, resultado).await() }
                log("ANDROID_RESPONDIO n=$n carta=${draw.card.nombre} tiempo=${resultado.tiempoMs}")
                draw.card
            }

            // No se puede sacar dos veces la misma carta (lo impiden las reglas).
            try {
                c.game.drawCard(code, uid, dia, 0, cartas[0])
                fail("Sacar dos veces la misma carta debería rechazarse")
            } catch (e: GameException) {
                log("CARTA_REPETIDA_RECHAZADA: ${e.message}")
            }

            val propias = c.game.answers(code).first { l -> l.count { it.uid == uid && it.estado == AnswerState.cerrada } == 2 }
            val fila = computeStandings(c.game.players(code).first(), propias, emptyList(), false).first { it.uid == uid }
            assertTrue("puntos tras 2 aciertos: ${fila.puntos}", fila.puntos in 10..14)
            log("PUNTOS_ANDROID=${fila.puntos}")

            if (esperarWeb) jugarConLaWeb(code, uid, dia, cartas[1])
        } finally {
            limpiar(code, uid)
        }
    }

    /** Espera a un jugador web, lo reta y comprueba que todo se ve en tiempo real en ambos sentidos. */
    private suspend fun jugarConLaWeb(code: String, uid: String, dia: Int, carta: com.triviadeldestino.app.game.CardId) {
        log("ESPERANDO_WEB")
        val web = withTimeout(240_000) { c.game.players(code).first { it.size >= 2 } }.first { it.uid != uid }
        log("WEB_UNIDO=${web.apodo}")

        val respuestas = withTimeout(240_000) {
            c.game.answers(code).first { l -> l.any { it.uid == web.uid && it.estado == AnswerState.cerrada } }
        }
        val filas = computeStandings(c.game.players(code).first(), respuestas, emptyList(), false)
        log("ANDROID_VE_CLASIFICACION=" + filas.joinToString { "${it.apodo}:${it.puntos}" })

        val pregunta = pickChallengeQuestion(c.questions.all, seenQuestionIds(web.uid, respuestas, emptyList()), carta, Random.Default)!!
        // El 2.º acierto (n = 1) desbloqueó el reto del día.
        c.game.sendChallenge(code, uid, web.uid, dia, 1, pregunta)
        log("RETO_ENVIADO a=${web.apodo}")

        val retos = withTimeout(240_000) {
            c.game.challenges(code).first { l -> l.any { it.id == challengeId(web.uid, dia) && it.estado == ChallengeState.resuelto } }
        }
        val reto = retos.first { it.id == challengeId(web.uid, dia) }
        val finales = computeStandings(c.game.players(code).first(), c.game.answers(code).first(), retos, false)
        log("RETO_RESUELTO correcta=${reto.correcta}")
        log("CLASIFICACION_FINAL=" + finales.joinToString { "${it.apodo}:${it.puntos}" })
        // Margen para que el script web verifique lo mismo antes de borrar el grupo.
        delay(20_000)
    }

    /** Borra el grupo de prueba (la creadora es administradora) y el usuario anónimo. */
    private suspend fun limpiar(code: String, uid: String) {
        val db = Firebase.firestore
        runCatching {
            for (sub in listOf("answers", "challenges", "players", "admins")) {
                db.collection("groups/$code/$sub").get().await().documents.forEach { it.reference.delete().await() }
            }
            db.document(Paths.adminKey(code)).delete().await()
            db.document(Paths.group(code)).delete().await()
            db.document(Paths.user(uid)).update("grupoActual", null).await()
            log("LIMPIEZA_OK")
        }.onFailure { log("LIMPIEZA_FALLO ${it.message}") }
        runCatching { Firebase.auth.currentUser?.delete()?.await() }
    }
}
