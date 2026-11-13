package com.triviadeldestino.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.triviadeldestino.app.game.AnswerState
import com.triviadeldestino.app.game.ChallengeEvent
import com.triviadeldestino.app.game.ChallengeState
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.TipoReto
import com.triviadeldestino.app.game.dailyPoints
import com.triviadeldestino.app.game.msUntilNextDay
import com.triviadeldestino.app.game.sentChallenge
import com.triviadeldestino.app.game.tipoReto
import com.triviadeldestino.app.ui.GameUiState
import com.triviadeldestino.app.ui.GameViewModel
import com.triviadeldestino.app.ui.cards.ChallengeCard
import com.triviadeldestino.app.ui.cards.Deck
import com.triviadeldestino.app.ui.cards.TarotCard
import com.triviadeldestino.app.ui.quick.QuickMatchBanner
import com.triviadeldestino.app.ui.components.CartasDelDia
import com.triviadeldestino.app.ui.components.GroupCodeCard
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.OrnateFrame
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.components.Variante
import com.triviadeldestino.app.ui.components.formatDuration
import com.triviadeldestino.app.ui.theme.Acierto
import com.triviadeldestino.app.ui.theme.Carmesi
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.OroClaro

@Composable
fun HomeScreen(
    vm: GameViewModel,
    s: GameUiState,
    onRevelar: () -> Unit,
    /** Ver una carta del día: `n` de una ya respondida, o −1 para la que está en juego. */
    onVerJugada: (Int) -> Unit,
    onResponderReto: (String) -> Unit,
    onRetar: () -> Unit,
    onCeremonia: () -> Unit,
    onRapida: () -> Unit = {},
) {
    val group = s.group ?: return
    val c = GameConfig.DEFAULT
    val faltan = formatDuration(msUntilNextDay(group.fechaInicioMs, s.now))
    val solo = s.players.count { !it.esBot } <= 1
    var clave by remember(group.code) { mutableStateOf<String?>(null) }
    LaunchedEffect(group.code, s.isCreator) { if (s.isCreator) clave = vm.claveAdmin() }

    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    if (s.seasonOver) "La temporada terminó" else "Día ${s.day + 1} de ${c.diasTemporada}",
                    style = MaterialTheme.typography.headlineLarge,
                    color = OroClaro,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    when {
                        s.seasonOver -> "Las cartas ya hablaron."
                        s.day + 1 < c.diasTemporada -> "El próximo día empieza en $faltan."
                        else -> "Último día: la temporada cierra en $faltan."
                    },
                    color = Niebla,
                )
                if (s.seasonOver) {
                    Spacer(Modifier.height(12.dp))
                    TriviaButton("Ver la ceremonia", onCeremonia, large = true)
                }
            }
        }

        if (s.myPending.isNotEmpty() && !s.seasonOver) {
            item {
                OrnateFrame(title = "Retos pendientes", borderColor = Carmesi.copy(alpha = 0.8f)) {
                    s.myPending.forEach { r ->
                        val (titulo, detalle) = textoPendiente(r, s)
                        Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            ChallengeCard(s.apodoDe(if (tipoReto(r) == TipoReto.devuelto) r.para else r.de), Modifier.width(76.dp))
                            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                                Text(titulo)
                                Nota(detalle)
                                Spacer(Modifier.height(8.dp))
                                TriviaButton(
                                    if (r.estado == ChallengeState.abierto) "Continuar el reto" else "Responder reto",
                                    { onResponderReto(r.id) },
                                    enabled = s.online,
                                )
                            }
                        }
                    }
                }
            }
        }

        if (s.isPlayer && !s.seasonOver) {
            item {
                OrnateFrame(title = "Tus cartas de hoy") {
                    val enJuego = s.myTodayAnswers.firstOrNull { it.estado != AnswerState.cerrada }
                    val cerradas = s.myTodayAnswers.filter { it.estado == AnswerState.cerrada }
                    val total = c.preguntasPorDia
                    CartasDelDia(s.myTodayAnswers)
                    Spacer(Modifier.height(16.dp))
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        when {
                            enJuego != null -> {
                                Text(
                                    if (enJuego.estado == AnswerState.carta) {
                                        "Tu carta ${enJuego.n + 1} está volteada: ${enJuego.carta.nombre}. Decide si la juegas o usas el comodín."
                                    } else {
                                        "¡Tienes una pregunta en curso! El tiempo corre."
                                    },
                                    textAlign = TextAlign.Center,
                                )
                                Spacer(Modifier.height(10.dp))
                                TriviaButton("Continuar", { onVerJugada(-1) }, large = true)
                            }
                            s.puedeSacarCarta -> {
                                TriviaButton(
                                    when {
                                        !s.online -> "Sin conexión"
                                        cerradas.isEmpty() -> "Revelar mi destino"
                                        else -> "Sacar carta ${cerradas.size + 1} de $total"
                                    },
                                    onRevelar,
                                    enabled = s.online,
                                    large = true,
                                )
                                Nota(
                                    "$total cartas al día: +${c.puntosCorrecta} por acierto y +${c.bonoRapidez} si respondes en menos de ${c.umbralRapidezMs / 1000} s. " +
                                        "Comodín: ${if (s.comodinDisponible) "disponible" else "ya usado hoy"}.",
                                    Modifier.padding(top = 10.dp),
                                    center = true,
                                )
                            }
                            cerradas.size >= total -> Nota("Jugaste tus $total cartas de hoy. Las próximas llegan en $faltan.", center = true)
                            else -> Nota("Responde tu reto pendiente para sacar la siguiente carta.", center = true)
                        }
                        cerradas.lastOrNull()?.let { ultima ->
                            Text(
                                "Ver la última pregunta y su explicación",
                                color = OroClaro,
                                style = MaterialTheme.typography.bodyMedium.copy(textDecoration = TextDecoration.Underline),
                                modifier = Modifier
                                    .padding(top = 6.dp)
                                    .clickable(role = Role.Button, onClick = { onVerJugada(ultima.n) })
                                    .padding(vertical = 8.dp),
                            )
                        }
                    }
                    if (vm.puedeRetar()) {
                        Spacer(Modifier.height(12.dp))
                        Text("¡Reto desbloqueado!", style = MaterialTheme.typography.titleMedium, color = OroClaro)
                        Nota("Llevas ${c.aciertosParaRetar} aciertos hoy. Envía una pregunta difícil a alguien del grupo: si falla, +${c.puntosReto} para ti; si acierta, se los lleva.")
                        Spacer(Modifier.height(8.dp))
                        TriviaButton("Lanzar un reto", onRetar, variante = Variante.Violeta)
                    }
                    s.uid?.let { sentChallenge(it, s.day, s.challenges) }?.let { miReto ->
                        Spacer(Modifier.height(12.dp))
                        Nota(textoMiReto(miReto, s))
                    }
                }
            }
        }

        if (s.isCreator && !s.isPlayer) {
            item {
                OrnateFrame(title = "Organizas este grupo") {
                    Nota("Este dispositivo no juega. Administra el grupo desde la web con la clave de abajo.", center = true)
                }
            }
        }

        // Solo mientras no haya nadie más: después, el código y la clave están en Perfil.
        if (solo) {
            item {
                OrnateFrame(title = "Invita a tu grupo") {
                    GroupCodeCard(group.code, group.nombre)
                    if (s.isCreator) {
                        Spacer(Modifier.height(16.dp))
                        AdminKeyBox(clave, group.code)
                    }
                }
            }
        }

        // Partida Rápida: modo aparte, sin grupo ni clasificación.
        item { QuickMatchBanner(sinGrupo = false, onClick = onRapida) }
    }
}

/** Título y explicación de una pregunta de reto pendiente, según su tipo (igual que en la web). */
private fun textoPendiente(c: ChallengeEvent, s: GameUiState): Pair<String, String> {
    val g = GameConfig.DEFAULT
    val cuando = if (c.dia < s.day) " (día ${c.dia + 1})" else ""
    return when (tipoReto(c)) {
        TipoReto.reto -> "${s.apodoDe(c.de)} te lanzó un reto$cuando." to
            "Es obligatorio antes de tu siguiente carta. Si aciertas +${g.puntosReto}; si fallas −${g.penalizacionReto}. También puedes devolverlo (${g.porcentajeDevolucion} % de éxito)."
        TipoReto.devuelto -> "${s.apodoDe(c.para)} te devolvió tu reto$cuando." to
            "Debes responderlo antes de tu siguiente carta: si aciertas no ganas nada; si fallas −${g.penalizacionReto}."
        TipoReto.doble -> "Doble reto de ${s.apodoDe(c.de)}: pregunta 1 de 2$cuando." to
            "La devolución falló. +${g.puntosReto} si aciertas alguna de las dos; −${g.penalizacionReto} por cada fallo."
        TipoReto.extra -> "Doble reto de ${s.apodoDe(c.de)}: pregunta 2 de 2$cuando." to
            "+${g.puntosReto} si aciertas alguna de las dos; −${g.penalizacionReto} por cada fallo."
    }
}
