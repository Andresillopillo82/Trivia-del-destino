package com.triviadeldestino.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.triviadeldestino.app.game.AnswerEvent
import com.triviadeldestino.app.game.AnswerState
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.dailyPoints
import com.triviadeldestino.app.ui.cards.CardBack
import com.triviadeldestino.app.ui.cards.TarotCard
import com.triviadeldestino.app.ui.theme.Acierto
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.VioletaClaro

/** Descripción de una carta del día para TalkBack. */
private fun describir(a: AnswerEvent?, i: Int): String {
    val num = "Carta ${i + 1}"
    return when {
        a == null -> "$num: sin sacar"
        a.estado != AnswerState.cerrada -> "$num: ${a.carta.nombre}, en juego"
        a.correcta -> "$num: ${a.carta.nombre}, acertada, +${dailyPoints(a.correcta, a.tiempoMs)}"
        else -> "$num: ${a.carta.nombre}, fallada"
    }
}

/** Las 3 cartas del día: respondidas (con su resultado), la que está en juego y las que faltan. */
@Composable
fun CartasDelDia(answers: List<AnswerEvent>, modifier: Modifier = Modifier) {
    val total = GameConfig.DEFAULT.preguntasPorDia
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)) {
        repeat(total) { i ->
            val a = answers.firstOrNull { it.n == i }
            Column(
                Modifier.width(64.dp).clearAndSetSemantics { contentDescription = describir(a, i) },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.alpha(if (a?.estado == AnswerState.cerrada) 1f else 0.6f)) {
                    if (a != null) TarotCard(a.carta, Modifier.fillMaxWidth()) else CardBack(Modifier.fillMaxWidth())
                }
                // Una sola línea que se reduce con letra grande (la columna es estrecha).
                TextoAjustable(
                    when {
                        a == null -> "${i + 1}/$total"
                        a.estado != AnswerState.cerrada -> "en juego"
                        a.correcta -> "+${dailyPoints(a.correcta, a.tiempoMs)}"
                        else -> "✗"
                    },
                    MaterialTheme.typography.labelMedium,
                    when {
                        a == null || a.estado != AnswerState.cerrada -> Niebla
                        a.correcta -> Acierto
                        else -> Error
                    },
                    Modifier.padding(top = 4.dp),
                    minimo = 6.sp,
                )
                // Debajo de la carta (no encima): así nunca queda recortado por el contenedor.
                if (a?.comodin == true) TextoAjustable("comodín", MaterialTheme.typography.labelSmall, VioletaClaro, minimo = 6.sp)
            }
        }
    }
}
