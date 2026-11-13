package com.triviadeldestino.app.game

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Paridad de la Partida Rápida: misma semilla ⇒ mismas preguntas, mismo reloj, mismo ranking y
 * mismos bots que la web (sección "rapida" de paridad.json, node scripts/export-parity-fixture.mjs).
 */
class QuickParityTest {
    private val rapida: JsonObject = Json.parseToJsonElement(
        requireNotNull(javaClass.getResource("/paridad.json")).readText(),
    ).jsonObject.getValue("rapida").jsonObject

    private fun JsonObject.str(k: String) = getValue(k).jsonPrimitive.content

    private val banco: List<Question> = rapida.getValue("banco").jsonArray.map {
        val o = it.jsonObject
        Question(o.str("id"), "", o.str("carta"), Nivel.valueOf(o.str("nivel")), "", listOf("A", "B", "C", "D"), 0, "")
    }

    private val cfg = QuickMatchConfig.DEFAULT

    @Test
    fun secuenciasIgualesQueLaWeb() {
        rapida.getValue("secuencias").jsonArray.forEachIndexed { i, s ->
            val o = s.jsonObject
            val ids = buildQuickSequence(
                o.getValue("seed").jsonPrimitive.long,
                banco,
                cfg.difficulty,
                o.getValue("length").jsonPrimitive.int,
                o.getValue("evitar").jsonArray.map { it.jsonPrimitive.content },
            ).map { it.id }
            assertEquals("secuencia $i", o.getValue("ids").jsonArray.map { it.jsonPrimitive.content }, ids)
        }
    }

    @Test
    fun relojIgualQueLaWeb() {
        rapida.getValue("relojes").jsonArray.forEachIndexed { i, r ->
            val o = r.jsonObject
            val c = cfg.copy(maxSeconds = o.getValue("maxSeconds").jsonPrimitive.intOrNull)
            var reloj = startClock(c, 1000)
            val estados = o.getValue("estados").jsonArray
            o.getValue("ops").jsonArray.forEachIndexed { k, op ->
                val p = op.jsonObject
                reloj = applyAnswer(reloj, p.getValue("correcta").jsonPrimitive.boolean, p.getValue("atMs").jsonPrimitive.long, c)
                val e = estados[k].jsonObject
                val esperado = QuickClock(
                    e.getValue("deadlineMs").jsonPrimitive.long,
                    e.getValue("correctas").jsonPrimitive.int,
                    e.getValue("falladas").jsonPrimitive.int,
                    e.getValue("finished").jsonPrimitive.boolean,
                )
                assertEquals("reloj $i, paso $k", esperado, reloj)
            }
        }
    }

    @Test
    fun rankingIgualQueLaWeb() {
        rapida.getValue("rankings").jsonArray.forEachIndexed { i, r ->
            val o = r.jsonObject
            val players = o.getValue("players").jsonArray.map {
                val p = it.jsonObject
                QuickPlayer(p.str("uid"), p.str("apodo"), AvatarId.fromId(p.str("avatar")), false, 1, p.getValue("correctas").jsonPrimitive.int, p.getValue("falladas").jsonPrimitive.int, true)
            }
            val esperado = o.getValue("esperado").jsonArray.map { it.jsonObject.str("uid") to it.jsonObject.getValue("posicion").jsonPrimitive.int }
            assertEquals("ranking $i", esperado, rankQuick(players).map { it.player.uid to it.posicion })
        }
    }

    @Test
    fun botsIgualesQueLaWeb() {
        val casos = rapida.getValue("bots").jsonArray
        assertTrue(casos.size >= QUICK_BOTS.size)
        casos.forEachIndexed { i, b ->
            val o = b.jsonObject
            val bot = QUICK_BOTS.first { it.uid == o.str("uid") }
            val run = simulateQuickBot(bot, o.getValue("seed").jsonPrimitive.long, banco, cfg)
            val r = o.getValue("run").jsonObject
            val eventos = r.getValue("eventos").jsonArray.map {
                QuickBotEvent(it.jsonObject.getValue("atMs").jsonPrimitive.long, it.jsonObject.getValue("correcta").jsonPrimitive.boolean)
            }
            assertEquals("bot $i (${bot.uid})", QuickBotRun(bot.uid, eventos, r.getValue("finMs").jsonPrimitive.long), run)
        }
    }

    @Test
    fun salaYDesempates() {
        val sala = newRoom("ABCDE", "host", true, 11, 0)
        assertEquals(6L * 3600_000, sala.expiresAtMs)
        val p = { uid: String, c: Int, f: Int, fin: Boolean -> QuickPlayer(uid, uid, AvatarId.LUNA, false, 1, c, f, fin) }
        assertEquals(JoinCheck.ok, canJoin(sala, emptyList(), "u", 0))
        assertEquals(false, canStart(sala, listOf(p("ana", 0, 0, false))))
        assertEquals(true, canStart(sala, listOf(p("ana", 0, 0, false), p("host", 0, 0, false))))
        assertEquals(false, canStart(sala, listOf(p("host", 0, 0, false), p("bot-luna", 0, 0, false).copy(esBot = true, round = 0))))
        assertEquals(JoinCheck.empezada, canJoin(sala.copy(status = QuickStatus.playing), emptyList(), "u", 0))
        assertEquals(JoinCheck.expirada, canJoin(sala, emptyList(), "u", sala.expiresAtMs))
        val jugando = sala.copy(status = QuickStatus.playing, startedAtMs = 1000)
        val ps = listOf(p("a", 1, 0, true), p("b", 2, 0, false))
        assertEquals(false, shouldFinish(jugando, ps, 2000))
        assertEquals(true, shouldFinish(jugando, ps, 1000 + cfg.hardTimeoutMs))
        assertEquals(listOf("a" to 1, "z" to 1, "m" to 3), rankQuick(listOf(p("z", 4, 2, true), p("a", 4, 2, true), p("m", 1, 0, true))).map { it.player.uid to it.posicion })
    }
}
