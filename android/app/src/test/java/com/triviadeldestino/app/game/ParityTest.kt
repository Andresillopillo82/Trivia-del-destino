package com.triviadeldestino.app.game

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Paridad web ↔ Android: los escenarios de src/test/resources/paridad.json se calcularon con la
 * lógica TypeScript de la web (node scripts/export-parity-fixture.mjs). Como cada cliente calcula
 * la clasificación por su cuenta, ambos deben dar exactamente el mismo resultado.
 */
class ParityTest {
    private val datos: JsonObject = Json.parseToJsonElement(
        requireNotNull(javaClass.getResource("/paridad.json")).readText(),
    ).jsonObject

    private fun JsonObject.str(k: String) = getValue(k).jsonPrimitive.content
    private fun JsonObject.strOrNull(k: String) = (get(k) as? JsonPrimitive)?.takeIf { it.isString }?.content

    @Test
    fun clasificacionYTitulosIgualesQueLaWeb() {
        val escenarios = datos.getValue("escenarios").jsonArray
        escenarios.forEachIndexed { i, e ->
            val esc = e.jsonObject
            val players = esc.getValue("players").jsonArray.map {
                val o = it.jsonObject
                PlayerInfo(o.str("uid"), o.str("apodo"), AvatarId.fromId(o.str("avatar")), o.getValue("esBot").jsonPrimitive.booleanOrNull == true)
            }
            val answers = esc.getValue("answers").jsonArray.map {
                val o = it.jsonObject
                AnswerEvent(
                    uid = o.str("uid"),
                    dia = o.getValue("dia").jsonPrimitive.int,
                    n = o.getValue("n").jsonPrimitive.int,
                    preguntaId = o.strOrNull("preguntaId"),
                    carta = requireNotNull(CardId.fromId(o.str("carta"))),
                    comodin = o.getValue("comodin").jsonPrimitive.booleanOrNull == true,
                    estado = AnswerState.valueOf(o.str("estado")),
                    opcion = o.getValue("opcion").jsonPrimitive.intOrNull,
                    correcta = o.getValue("correcta").jsonPrimitive.booleanOrNull == true,
                    tiempoMs = o.getValue("tiempoMs").jsonPrimitive.long,
                    retoPara = o.strOrNull("retoPara"),
                )
            }
            val challenges = esc.getValue("challenges").jsonArray.map {
                val o = it.jsonObject
                ChallengeEvent(
                    id = o.str("id"),
                    de = o.str("de"),
                    para = o.str("para"),
                    dia = o.getValue("dia").jsonPrimitive.int,
                    preguntaId = o.str("preguntaId"),
                    carta = requireNotNull(CardId.fromId(o.str("carta"))),
                    estado = ChallengeState.valueOf(o.str("estado")),
                    extra = o.getValue("extra").jsonPrimitive.booleanOrNull == true,
                    devueltoEnMs = o.getValue("devueltoEnMs").jsonPrimitive.longOrNull,
                    correcta = o.getValue("correcta").jsonPrimitive.booleanOrNull,
                    tiempoMs = o.getValue("tiempoMs").jsonPrimitive.longOrNull,
                )
            }
            val rows = computeStandings(
                players,
                answers,
                challenges,
                seasonClosed = esc.getValue("seasonClosed").jsonPrimitive.booleanOrNull == true,
            )
            val esperado = esc.getValue("esperado").jsonObject
            val filas = esperado.getValue("standings") as JsonArray
            assertEquals("escenario $i: número de filas", filas.size, rows.size)
            filas.forEachIndexed { j, f ->
                val o = f.jsonObject
                val r = rows[j]
                val donde = "escenario $i, fila $j"
                assertEquals("$donde: orden (uid)", o.str("uid"), r.uid)
                assertEquals("$donde: puntos", o.getValue("puntos").jsonPrimitive.int, r.puntos)
                assertEquals("$donde: aciertos", o.getValue("aciertos").jsonPrimitive.int, r.aciertos)
                assertEquals("$donde: respondidas", o.getValue("respondidas").jsonPrimitive.int, r.respondidas)
                val prom = o.getValue("tiempoPromedioMs").jsonPrimitive.doubleOrNull
                if (prom == null) assertEquals("$donde: promedio", null, r.tiempoPromedioMs)
                else assertEquals("$donde: promedio", prom, r.tiempoPromedioMs!!, 1e-9)
                assertEquals("$donde: racha actual", o.getValue("rachaActual").jsonPrimitive.int, r.rachaActual)
                assertEquals("$donde: mejor racha", o.getValue("mejorRacha").jsonPrimitive.int, r.mejorRacha)
                assertEquals("$donde: retos lanzados", o.getValue("retosLanzados").jsonPrimitive.int, r.retosLanzados)
                assertEquals("$donde: retos ganados", o.getValue("retosGanados").jsonPrimitive.int, r.retosGanados)
                assertEquals("$donde: posición", o.getValue("posicion").jsonPrimitive.int, r.posicion)
            }
            val titulos = esperado.getValue("titulos").jsonObject
            val t = awardTitles(rows)
            assertEquals("escenario $i: Dueño del Destino", titulos.strOrNull("duenoDelDestino"), t.duenoDelDestino?.uid)
            assertEquals("escenario $i: El Vidente", titulos.strOrNull("vidente"), t.vidente?.uid)
            assertEquals("escenario $i: El Retador", titulos.strOrNull("retador"), t.retador?.uid)

            // Retos que bloquean a cada jugador (incluye devueltos y dobles retos) y quién puede retar hoy.
            esperado.getValue("pendientes").jsonObject.forEach { (uid, ids) ->
                assertEquals("escenario $i: pendientes de $uid", ids.jsonArray.map { it.jsonPrimitive.content }, pendingChallengesFor(uid, challenges).map { it.id })
            }
            val hoy = esc.getValue("currentDay").jsonPrimitive.int
            esperado.getValue("puedeRetar").jsonObject.forEach { (uid, puede) ->
                assertEquals("escenario $i: $uid puede retar", puede.jsonPrimitive.booleanOrNull == true, canSendChallenge(uid, hoy, answers))
            }
        }
    }

    @Test
    fun devolucionDeRetosIgualQueLaWeb() {
        datos.getValue("devoluciones").jsonArray.forEachIndexed { i, d ->
            val o = d.jsonObject
            val ms = o.getValue("ms").jsonPrimitive.long
            assertEquals("caso $i ($ms ms)", o.getValue("exito").jsonPrimitive.booleanOrNull == true, devolucionExitosa(ms))
        }
    }

    @Test
    fun diaDeTemporadaIgualQueLaWeb() {
        datos.getValue("dias").jsonArray.forEachIndexed { i, d ->
            val o = d.jsonObject
            val inicio = o.getValue("inicio").jsonPrimitive.long
            val ahora = o.getValue("ahora").jsonPrimitive.long
            val offset = o.getValue("offset").jsonPrimitive.int
            assertEquals("caso $i: día", o.getValue("dia").jsonPrimitive.int, seasonDay(inicio, offset, ahora))
            assertEquals("caso $i: falta para el siguiente día", o.getValue("faltaMs").jsonPrimitive.long, msUntilNextDay(inicio, ahora))
        }
    }
}
