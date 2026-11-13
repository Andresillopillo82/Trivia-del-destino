package com.triviadeldestino.app.game

/** Banco sintético solo para pruebas: `normales` y `hards` preguntas por carta. */
fun makeQuestions(normales: Int = 3, hards: Int = 2): List<Question> =
    CardId.entries.flatMap { c ->
        (1..normales + hards).map { i ->
            val nivel = if (i <= normales) Nivel.normal else Nivel.hard
            Question(
                id = "${c.id}-${if (nivel == Nivel.normal) "n" else "h"}$i",
                categoria = c.categoria,
                carta = c.nombre,
                nivel = nivel,
                pregunta = "Pregunta de prueba $i de ${c.nombre}",
                opciones = listOf("A", "B", "C", "D"),
                respuestaCorrecta = i % 4,
                explicacion = "Explicación de prueba",
            )
        }
    }

fun player(uid: String, esBot: Boolean = false) = PlayerInfo(uid, uid, AvatarId.SOL, esBot)

fun answer(
    uid: String,
    dia: Int,
    correcta: Boolean = true,
    tiempoMs: Long = 10_000,
    estado: AnswerState = AnswerState.cerrada,
    retoPara: String? = null,
    n: Int = 0,
    preguntaId: String? = "q-$uid-$dia-$n",
    comodin: Boolean = false,
) = AnswerEvent(uid, dia, n, preguntaId, CardId.LOCO, comodin, estado, if (estado == AnswerState.cerrada) 0 else null, correcta, tiempoMs, retoPara)

fun challenge(
    de: String,
    para: String,
    dia: Int,
    estado: ChallengeState = ChallengeState.pendiente,
    correcta: Boolean? = null,
    preguntaId: String = "h-$para-$dia",
    devueltoEnMs: Long? = null,
) = ChallengeEvent("${para}_$dia", de, para, dia, preguntaId, CardId.MAGO, estado, false, devueltoEnMs, correcta, null)

/** Pregunta extra del doble reto de `para` ese día. */
fun extraChallenge(de: String, para: String, dia: Int, estado: ChallengeState = ChallengeState.pendiente, correcta: Boolean? = null) =
    ChallengeEvent("${para}_${dia}_2", de, para, dia, "h2-$para-$dia", CardId.MAGO, estado, true, null, correcta, null)

/** Horas del servidor de ejemplo: ms % 100 < 30 la devolución sale bien; si no, falla. */
const val DEVUELTO_BIEN_MS = 1_760_000_000_012L
const val DEVUELTO_MAL_MS = 1_760_000_000_077L
