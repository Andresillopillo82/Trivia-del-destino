package com.triviadeldestino.app.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StandingsTest {
    private fun rows(
        players: List<PlayerInfo>,
        answers: List<AnswerEvent> = emptyList(),
        challenges: List<ChallengeEvent> = emptyList(),
        seasonClosed: Boolean = false,
    ) = computeStandings(players, answers, challenges, seasonClosed = seasonClosed)

    @Test
    fun puntosDiariosConBonusDeRapidez() {
        val r = rows(
            listOf(player("ana")),
            listOf(
                answer("ana", 0, tiempoMs = 5_000, n = 0),
                answer("ana", 0, tiempoMs = 12_000, n = 1),
                answer("ana", 0, correcta = false, tiempoMs = 3_000, n = 2),
            ),
        ).single()
        assertEquals(12, r.puntos) // 7 + 5 + 0
        assertEquals(2, r.aciertos)
        assertEquals(20_000.0 / 3, r.tiempoPromedioMs!!, 1e-9)
    }

    @Test
    fun respuestaAbiertaOCartaSinAbrirNoSuman() {
        val r = rows(
            listOf(player("ana")),
            listOf(
                answer("ana", 0, correcta = false, tiempoMs = 0, estado = AnswerState.abierta),
                answer("ana", 1, correcta = false, tiempoMs = 0, estado = AnswerState.carta, preguntaId = null),
            ),
        ).single()
        assertEquals(0, r.puntos)
        assertEquals(0, r.respondidas)
        assertNull(r.tiempoPromedioMs)
    }

    @Test
    fun puntosDeRetos() {
        val jugadores = listOf(player("ana"), player("beto"))
        fun puntos(retos: List<ChallengeEvent>, cerrada: Boolean = false) =
            rows(jugadores, challenges = retos, seasonClosed = cerrada).associate { it.uid to it.puntos }
        assertEquals(mapOf("beto" to 10, "ana" to 0), puntos(listOf(challenge("ana", "beto", 0, ChallengeState.resuelto, true))))
        assertEquals(mapOf("ana" to 10, "beto" to -5), puntos(listOf(challenge("ana", "beto", 0, ChallengeState.resuelto, false))))
        assertEquals(mapOf("ana" to 0, "beto" to 0), puntos(listOf(challenge("ana", "beto", 0))))
        assertEquals(mapOf("ana" to 10, "beto" to -5), puntos(listOf(challenge("ana", "beto", 0)), cerrada = true))
        // Doble reto: la extra se suma al reto principal y no cuenta como otro reto lanzado.
        val doble = rows(
            jugadores,
            challenges = listOf(
                challenge("ana", "beto", 0, ChallengeState.resuelto, false, devueltoEnMs = DEVUELTO_MAL_MS),
                extraChallenge("ana", "beto", 0, ChallengeState.resuelto, false),
            ),
        )
        assertEquals(-10, doble.first { it.uid == "beto" }.puntos)
        assertEquals(1, doble.first { it.uid == "ana" }.retosLanzados)
        assertEquals(1, doble.first { it.uid == "ana" }.retosGanados)
    }

    @Test
    fun desempates() {
        // Empate en puntos (10): gana quien tiene más aciertos (ana 2; beto ganó un reto sin aciertos).
        val a = rows(
            listOf(player("ana"), player("beto"), player("caro")),
            listOf(answer("ana", 0, n = 0), answer("ana", 0, n = 1)),
            listOf(challenge("beto", "caro", 0, ChallengeState.resuelto, false)),
        )
        assertEquals(listOf("ana", "beto"), a.take(2).map { it.uid })
        // Empate en puntos y aciertos: menor tiempo promedio.
        val b = rows(listOf(player("ana"), player("beto")), listOf(answer("ana", 0, tiempoMs = 12_000), answer("beto", 0, tiempoMs = 9_000)))
        assertEquals(listOf("beto" to 1, "ana" to 2), b.map { it.uid to it.posicion })
        // Empate total: comparten posición.
        val c = rows(listOf(player("beto"), player("ana"), player("caro")), listOf(answer("ana", 0), answer("beto", 0)))
        assertEquals(listOf("ana" to 1, "beto" to 1, "caro" to 3), c.map { it.uid to it.posicion })
    }

    @Test
    fun rachasDeAciertosSeguidos() {
        fun resp(vararg r: Triple<Int, Int, Boolean>) = r.map { (dia, n, ok) -> answer("x", dia, correcta = ok, n = n) }
        assertEquals(
            Streaks(3, 3),
            streaks(resp(Triple(0, 0, true), Triple(0, 1, true), Triple(0, 2, false), Triple(1, 0, true), Triple(1, 1, true), Triple(1, 2, true))),
        )
        // Las preguntas sin jugar no cortan la racha; el orden de llegada no importa.
        assertEquals(Streaks(3, 3), streaks(resp(Triple(3, 0, true), Triple(0, 1, true), Triple(0, 2, true))))
        assertEquals(Streaks(2, 0), streaks(resp(Triple(1, 0, true), Triple(1, 1, true), Triple(1, 2, false))))
    }

    @Test
    fun titulos() {
        val r = rows(
            listOf(player("ana"), player("beto"), player("caro")),
            listOf(answer("ana", 0, n = 0), answer("ana", 0, n = 1), answer("ana", 0, n = 2), answer("beto", 0), answer("caro", 0), answer("caro", 1, correcta = false)),
            listOf(challenge("beto", "caro", 0, ChallengeState.resuelto, false), challenge("beto", "ana", 1, ChallengeState.resuelto, false)),
        )
        val t = awardTitles(r)
        assertEquals("beto", t.duenoDelDestino?.uid)
        assertEquals("ana", t.vidente?.uid)
        assertEquals("beto", t.retador?.uid)
        assertEquals(Titles(null, null, null), awardTitles(rows(listOf(player("ana")))))
    }
}
