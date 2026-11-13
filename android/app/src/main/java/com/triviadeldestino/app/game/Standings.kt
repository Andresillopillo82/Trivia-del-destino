package com.triviadeldestino.app.game

/**
 * Clasificación calculada a partir de los eventos (src/game/standings.ts y titles.ts).
 * La web y Android deben dar exactamente el mismo resultado: lo comprueba ParityTest.
 */

data class Streaks(val mejor: Int, val actual: Int)

/**
 * Aciertos seguidos en las preguntas del día, en orden de día y número de pregunta.
 * Solo cuentan las respondidas: las que no se jugaron no cortan la racha, un fallo sí.
 */
fun streaks(answers: List<AnswerEvent>): Streaks {
    var mejor = 0
    var actual = 0
    for (a in answers.filter { it.estado == AnswerState.cerrada }.sortedWith(compareBy({ it.dia }, { it.n }))) {
        actual = if (a.correcta) actual + 1 else 0
        mejor = maxOf(mejor, actual)
    }
    return Streaks(mejor, actual)
}

/** Criterios de desempate: más puntos, más aciertos, menor tiempo promedio. 0 = empate total. */
private fun tieCompare(a: StandingRow, b: StandingRow): Int {
    if (a.puntos != b.puntos) return b.puntos - a.puntos
    if (a.aciertos != b.aciertos) return b.aciertos - a.aciertos
    val ta = a.tiempoPromedioMs ?: Double.POSITIVE_INFINITY
    val tb = b.tiempoPromedioMs ?: Double.POSITIVE_INFINITY
    return ta.compareTo(tb)
}

/**
 * Orden estable entre empatados: por apodo y luego uid, carácter a carácter (igual que la web),
 * para no depender del idioma del teléfono.
 */
private val ordenEstable = Comparator<StandingRow> { a, b -> tieCompare(a, b) }
    .thenBy { it.apodo }
    .thenBy { it.uid }

fun computeStandings(
    players: List<PlayerInfo>,
    answers: List<AnswerEvent>,
    challenges: List<ChallengeEvent>,
    seasonClosed: Boolean,
    config: GameConfig = GameConfig.DEFAULT,
): List<StandingRow> {
    val uids = players.map { it.uid }.toSet()
    val respuestas = answers.filter { it.uid in uids }.groupBy { it.uid }
    val lanzados = HashMap<String, Int>()
    val ganados = HashMap<String, Int>()
    val puntosRetos = HashMap<String, Int>()
    val porId = challenges.associateBy { it.id }
    for (c in challenges) {
        if (c.extra) continue
        lanzados[c.de] = (lanzados[c.de] ?: 0) + 1
        for (r in scoreChallenge(c, porId[extraChallengeId(c.para, c.dia)], seasonClosed, config)) {
            puntosRetos[r.uid] = (puntosRetos[r.uid] ?: 0) + r.puntos
            if (r.gano) ganados[r.uid] = (ganados[r.uid] ?: 0) + 1
        }
    }

    val filas = players.map { p ->
        val propias = respuestas[p.uid].orEmpty()
        val cerradas = propias.filter { it.estado == AnswerState.cerrada }
        val aciertos = cerradas.count { it.correcta }
        val puntosDiarios = cerradas.sumOf { dailyPoints(it.correcta, it.tiempoMs, config) }
        val lanz = lanzados[p.uid] ?: 0
        val gan = ganados[p.uid] ?: 0
        val racha = streaks(propias)
        StandingRow(
            uid = p.uid,
            apodo = p.apodo,
            avatar = p.avatar,
            esBot = p.esBot,
            puntos = puntosDiarios + (puntosRetos[p.uid] ?: 0),
            aciertos = aciertos,
            respondidas = cerradas.size,
            tiempoPromedioMs = if (cerradas.isEmpty()) null else cerradas.sumOf { it.tiempoMs }.toDouble() / cerradas.size,
            rachaActual = racha.actual,
            mejorRacha = racha.mejor,
            retosLanzados = lanz,
            retosGanados = gan,
            posicion = 0,
        )
    }.sortedWith(ordenEstable)

    // Posiciones: los empatados en todos los criterios comparten posición.
    val resultado = ArrayList<StandingRow>(filas.size)
    filas.forEachIndexed { i, fila ->
        val anterior = resultado.lastOrNull()
        val pos = if (anterior != null && tieCompare(anterior, fila) == 0) anterior.posicion else i + 1
        resultado += fila.copy(posicion = pos)
    }
    return resultado
}

/** Títulos de fin de temporada. En los secundarios, el empate lo gana quien va mejor clasificado. */
fun awardTitles(standings: List<StandingRow>): Titles {
    fun mejorPor(valor: (StandingRow) -> Int): StandingRow? {
        var mejor: StandingRow? = null
        for (r in standings) if (valor(r) > 0 && (mejor == null || valor(r) > valor(mejor))) mejor = r
        return mejor
    }
    val primero = standings.firstOrNull()
    return Titles(
        duenoDelDestino = primero?.takeIf { it.puntos > 0 },
        vidente = mejorPor { it.mejorRacha },
        retador = mejorPor { it.retosGanados },
    )
}
