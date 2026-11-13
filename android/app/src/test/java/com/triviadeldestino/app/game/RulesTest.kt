package com.triviadeldestino.app.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.ZoneId
import kotlin.random.Random

class QuestionBankTest {
    /** El banco real de la web (las pruebas se ejecutan desde android/app). */
    private val banco = parseQuestions(File("../../src/data/questions.json").readText())

    @Test
    fun tiene280PreguntasConIdsUnicos() {
        assertEquals(280, banco.size)
        assertEquals(280, banco.map { it.id }.toSet().size)
    }

    @Test
    fun cadaCartaTiene20NormalesY8Dificiles() {
        CardId.entries.forEach { c ->
            val deLaCarta = banco.filter { it.card == c }
            assertEquals(c.nombre, 20, deLaCarta.count { it.nivel == Nivel.normal })
            assertEquals(c.nombre, 8, deLaCarta.count { it.nivel == Nivel.hard })
            assertEquals(setOf(c.categoria), deLaCarta.map { it.categoria }.toSet())
        }
    }

    @Test
    fun rechazaBancosInvalidos() {
        val base = """{"id":"x","categoria":"Matemáticas","carta":"El Loco","nivel":"normal","pregunta":"¿?","opciones":["a","b","c","d"],"respuestaCorrecta":1,"explicacion":"e"}"""
        assertThrows(IllegalArgumentException::class.java) { parseQuestions("[$base,$base]") }
        assertThrows(IllegalArgumentException::class.java) { parseQuestions("[${base.replace("El Loco", "La Torre")}]") }
        assertThrows(IllegalArgumentException::class.java) { parseQuestions("[${base.replace("\"respuestaCorrecta\":1", "\"respuestaCorrecta\":4")}]") }
        assertThrows(IllegalArgumentException::class.java) { parseQuestions("[${base.replace("\"d\"]", "]").replace(",]", "]")}]") }
    }
}

class ScoringTest {
    private val q = makeQuestions(1, 0).first() // respuestaCorrecta = 1

    @Test
    fun evaluaRespuestas() {
        assertEquals(AnswerResult(1, true, 5_000), evaluateAnswer(q, 1, 5_000))
        assertFalse(evaluateAnswer(q, 2, 5_000).correcta)
        assertEquals(AnswerResult(null, false, 20_000), evaluateAnswer(q, null, 3_000))
        assertEquals(AnswerResult(null, false, 20_000), evaluateAnswer(q, 1, 25_000))
        assertEquals(0L, evaluateAnswer(q, 1, -50).tiempoMs)
    }

    @Test
    fun puntosDeLaPreguntaDiaria() {
        assertEquals(5, dailyPoints(true, 12_000))
        assertEquals(7, dailyPoints(true, 7_999))
        assertEquals(5, dailyPoints(true, 8_000))
        assertEquals(0, dailyPoints(false, 1_000))
        assertEquals(5, dailyPoints(true, 500, GameConfig(puntosCorrecta = 3, bonoRapidez = 2, umbralRapidezMs = 1_000)))
    }

    @Test
    fun temporizadorArrancaTrasLaPausaDeRevelacion() {
        assertEquals(0L, elapsedMs(1_000, 2_000))
        assertEquals(20_000L, remainingMs(1_000, 4_000))
        assertEquals(5_000L, elapsedMs(1_000, 9_000))
        assertFalse(isExpired(1_000, 23_999))
        assertTrue(isExpired(1_000, 24_000))
    }
}

class DrawTest {
    private val qs = makeQuestions(3, 2)

    @Test
    fun laCartaCorrespondeALaPregunta() {
        val d = drawQuestion(qs, emptySet(), Random(1))!!
        assertEquals(d.card, d.question.card)
        assertEquals(Nivel.normal, d.question.nivel)
    }

    @Test
    fun noRepitePreguntasHastaAgotarlas() {
        val rnd = Random(42)
        val vistas = HashSet<String>()
        repeat(30) {
            val d = drawQuestion(qs, vistas, rnd)!!
            assertTrue("repetida: ${d.question.id}", vistas.add(d.question.id))
        }
        assertNull(drawQuestion(qs, vistas, rnd))
    }

    @Test
    fun soloEligeCartasConPreguntasDisponibles() {
        val vistas = qs.filter { it.id != "mundo-n2" }.map { it.id }.toSet()
        repeat(20) { s ->
            val d = drawQuestion(qs, vistas, Random(s))!!
            assertEquals(CardId.MUNDO, d.card)
            assertEquals("mundo-n2", d.question.id)
        }
    }

    @Test
    fun puedeSacarLasDiezCartasYEsDeterminista() {
        val rnd = Random(7)
        assertEquals(10, (1..300).map { drawQuestion(qs, emptySet(), rnd)!!.card }.toSet().size)
        assertEquals(drawQuestion(qs, emptySet(), Random(9)), drawQuestion(qs, emptySet(), Random(9)))
    }

    @Test
    fun preguntasVistasIncluyenRetosRecibidos() {
        val vistas = seenQuestionIds(
            "ana",
            listOf(answer("ana", 0, preguntaId = "loco-n1"), answer("beto", 0, preguntaId = "mago-n1")),
            listOf(challenge("beto", "ana", 0, preguntaId = "loco-h4"), challenge("ana", "beto", 0, preguntaId = "mago-h4")),
        )
        assertEquals(setOf("loco-n1", "loco-h4"), vistas)
    }

    @Test
    fun cartaYPreguntaPorSeparadoParaElComodin() {
        repeat(20) { s ->
            val junto = drawQuestion(qs, emptySet(), Random(s))!!
            val rnd = Random(s)
            val carta = drawCard(qs, emptySet(), rnd)!!
            assertEquals(junto, Draw(carta, drawQuestionForCard(qs, emptySet(), carta, rnd)!!))
            assertNotEquals(CardId.LOCO, drawCard(qs, emptySet(), Random(s), setOf(CardId.LOCO)))
        }
        val soloMundo = qs.filter { it.card != CardId.MUNDO }.map { it.id }.toSet()
        assertEquals(CardId.MUNDO, drawCard(qs, soloMundo, Random(1)))
        assertNull(drawCard(qs, soloMundo, Random(1), setOf(CardId.MUNDO)))
    }

    @Test
    fun cartaSinAbrirNoTienePreguntaYElRetadorVeLoQueLeDevuelven() {
        val vistas = seenQuestionIds(
            "ana",
            listOf(answer("ana", 0, estado = AnswerState.carta, n = 1, preguntaId = null)),
            listOf(challenge("ana", "beto", 0, ChallengeState.devuelto, preguntaId = "mago-h4", devueltoEnMs = DEVUELTO_BIEN_MS)),
        )
        assertEquals(setOf("mago-h4"), vistas)
    }
}

class ChallengesTest {
    private val qs = makeQuestions(3, 2)

    private fun dia(vararg correctas: Boolean) = correctas.mapIndexed { n, ok -> answer("ana", 0, correcta = ok, n = n) }

    @Test
    fun seDesbloqueaConDosAciertosYSoloUnaVez() {
        assertFalse(canSendChallenge("ana", 0, dia(true, false, false)))
        assertEquals(1, unlockingAnswer("ana", 0, dia(true, true))?.n)
        assertEquals(2, unlockingAnswer("ana", 0, dia(false, true, true))?.n)
        assertTrue(canSendChallenge("ana", 0, dia(true, false, true)))
        // El 3.er acierto no da otro reto.
        val conReto = dia(true, true, true).mapIndexed { n, a -> if (n == 1) a.copy(retoPara = "beto") else a }
        assertFalse(canSendChallenge("ana", 0, conReto))
        assertFalse(canSendChallenge("ana", 1, dia(true, true)))
    }

    @Test
    fun maximoUnRetoRecibidoPorDia() {
        val jugadores = listOf(player("ana"), player("beto"), player("caro"))
        val retos = listOf(challenge("caro", "beto", 2), extraChallenge("ana", "caro", 2))
        assertEquals(listOf("beto", "caro"), eligibleTargets("ana", jugadores, emptyList(), 2).map { it.uid })
        assertEquals(listOf("caro"), eligibleTargets("ana", jugadores, retos, 2).map { it.uid })
        assertEquals(listOf("beto", "caro"), eligibleTargets("ana", jugadores, retos, 3).map { it.uid })
    }

    @Test
    fun preguntaDificilNoVistaPreferentementeDeLaCartaDelRetador() {
        assertEquals("loco-h5", pickChallengeQuestion(qs, setOf("loco-h4"), CardId.LOCO, Random(1))!!.id)
        val otra = pickChallengeQuestion(qs, setOf("loco-h4", "loco-h5"), CardId.LOCO, Random(1))!!
        assertEquals(Nivel.hard, otra.nivel)
        assertNotEquals(CardId.LOCO, otra.card)
        assertNull(pickChallengeQuestion(qs, qs.filter { it.nivel == Nivel.hard }.map { it.id }.toSet(), null, Random(1)))
    }

    @Test
    fun devolucionDecididaPorLaHoraDelServidor() {
        assertTrue(devolucionExitosa(1_000))
        assertTrue(devolucionExitosa(1_029))
        assertFalse(devolucionExitosa(1_030))
        assertEquals(300, (0L until 1000L).count { devolucionExitosa(1_760_000_000_000 + it) })

        val bien = challenge("ana", "beto", 0, ChallengeState.devuelto, devueltoEnMs = DEVUELTO_BIEN_MS)
        val mal = challenge("ana", "beto", 0, ChallengeState.devuelto, devueltoEnMs = DEVUELTO_MAL_MS)
        val extra = extraChallenge("ana", "beto", 0)
        assertEquals("ana", responsable(bien))
        assertEquals("beto", responsable(mal))
        assertTrue(esDobleReto(mal))
        assertFalse(isRequired(extra, listOf(bien, extra)))
        assertTrue(isRequired(extra, listOf(mal, extra)))
        assertTrue(canReturnChallenge(challenge("ana", "beto", 0), "beto"))
        assertFalse(canReturnChallenge(challenge("ana", "beto", 0), "ana"))
        assertFalse(canReturnChallenge(mal, "beto"))
        assertFalse(canReturnChallenge(extra, "beto"))

        assertEquals(TipoReto.reto, tipoReto(challenge("ana", "beto", 0)))
        assertEquals(TipoReto.reto, tipoReto(challenge("ana", "beto", 0, ChallengeState.devuelto)))
        assertEquals(TipoReto.devuelto, tipoReto(bien))
        assertEquals(TipoReto.doble, tipoReto(mal))
        assertEquals(TipoReto.extra, tipoReto(extra))
    }

    private fun puntos(base: ChallengeEvent, extra: ChallengeEvent? = null, cerrada: Boolean = false): Map<String, Int> =
        scoreChallenge(base, extra, cerrada).groupBy { it.uid }.mapValues { (_, v) -> v.sumOf { it.puntos } }

    @Test
    fun puntosDeUnReto() {
        assertEquals(emptyMap<String, Int>(), puntos(challenge("ana", "beto", 0)))
        assertEquals(mapOf("beto" to 10), puntos(challenge("ana", "beto", 0, ChallengeState.resuelto, true)))
        assertEquals(mapOf("beto" to -5, "ana" to 10), puntos(challenge("ana", "beto", 0, ChallengeState.resuelto, false)))
        assertEquals(mapOf("beto" to -5, "ana" to 10), puntos(challenge("ana", "beto", 0), cerrada = true))
        // Devuelto con éxito: el retador responde sin premio.
        val bien = { e: ChallengeState, ok: Boolean? -> challenge("ana", "beto", 0, e, ok, devueltoEnMs = DEVUELTO_BIEN_MS) }
        assertEquals(emptyMap<String, Int>(), puntos(bien(ChallengeState.resuelto, true)))
        assertEquals(mapOf("ana" to -5), puntos(bien(ChallengeState.resuelto, false)))
        // Devolución fallida: doble reto.
        val mal = { e: ChallengeState, ok: Boolean? -> challenge("ana", "beto", 0, e, ok, devueltoEnMs = DEVUELTO_MAL_MS) }
        val x = { e: ChallengeState, ok: Boolean? -> extraChallenge("ana", "beto", 0, e, ok) }
        assertEquals(mapOf("beto" to 10), puntos(mal(ChallengeState.resuelto, true), x(ChallengeState.resuelto, true)))
        assertEquals(mapOf("beto" to 5), puntos(mal(ChallengeState.resuelto, true), x(ChallengeState.resuelto, false)))
        assertEquals(mapOf("beto" to -10, "ana" to 10), puntos(mal(ChallengeState.resuelto, false), x(ChallengeState.resuelto, false)))
        assertEquals(mapOf("beto" to -5), puntos(mal(ChallengeState.resuelto, false), x(ChallengeState.pendiente, null)))
        assertEquals(mapOf("beto" to -10, "ana" to 10), puntos(mal(ChallengeState.devuelto, null), null, cerrada = true))
    }

    @Test
    fun pendientesObligatoriosDelMasAntiguoAlMasNuevo() {
        val retos = listOf(
            challenge("caro", "ana", 3),
            challenge("beto", "ana", 1),
            challenge("beto", "ana", 0, ChallengeState.resuelto, true),
            challenge("ana", "beto", 2),
            challenge("caro", "ana", 2, ChallengeState.abierto),
        )
        assertEquals(listOf(1, 2, 3), pendingChallengesFor("ana", retos).map { it.dia })

        val bien = challenge("ana", "beto", 0, ChallengeState.devuelto, devueltoEnMs = DEVUELTO_BIEN_MS)
        val mal = challenge("ana", "beto", 0, ChallengeState.devuelto, devueltoEnMs = DEVUELTO_MAL_MS)
        val extra = extraChallenge("ana", "beto", 0)
        assertEquals(listOf("beto_0"), pendingChallengesFor("ana", listOf(bien, extra)).map { it.id })
        assertEquals(emptyList<ChallengeEvent>(), pendingChallengesFor("beto", listOf(bien, extra)))
        assertEquals(listOf("beto_0", "beto_0_2"), pendingChallengesFor("beto", listOf(extra, mal)).map { it.id })
    }
}

class DayCodesValidationTest {
    private val zona = ZoneId.of("America/Bogota")
    private val inicio = LocalDate.of(2026, 10, 17).atStartOfDay(zona).toInstant().toEpochMilli()
    private val hora = 3_600_000L

    @Test
    fun diaDeTemporada() {
        assertEquals(0, seasonDay(inicio, 0, inicio + 10 * hora))
        assertEquals(1, seasonDay(inicio, 0, inicio + MS_DIA + hora))
        assertEquals(3, seasonDay(inicio, 3, inicio + hora))
        assertEquals(0, seasonDay(inicio, 0, inicio - hora))
        assertFalse(isSeasonOver(6))
        assertTrue(isSeasonOver(7))
        assertEquals(inicio, startOfLocalDay(inicio + 13 * hora, zona))
        assertEquals(4 * hora, msUntilNextDay(inicio, inicio + 20 * hora))
    }

    @Test
    fun codigosDeGrupo() {
        assertEquals("A7K2Q", normalizeGroupCode(" a7k-2q "))
        assertTrue(isValidGroupCode("A7K2Q"))
        assertFalse(isValidGroupCode("A7K2"))
        assertFalse(isValidGroupCode("A0K2Q")) // sin 0, O, 1 ni I
        assertEquals("A7K2Q", groupCodeFrom("https://trivia-59073.web.app/unirse/A7K2Q"))
        assertEquals("A7K2Q", groupCodeFrom("a7k2q"))
        assertNull(groupCodeFrom("https://otra-cosa.com"))
    }

    @Test
    fun apodo() {
        assertEquals("Luna Errante", cleanText("  Luna \n  Errante\u0007 "))
        assertNotNull(validateApodo("A"))
        assertNull(validateApodo("Ñu"))
        assertNotNull(validateApodo("x".repeat(17)))
    }
}
