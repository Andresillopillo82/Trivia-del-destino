package com.triviadeldestino.app.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.triviadeldestino.app.data.ServerClock
import com.triviadeldestino.app.data.friendlyMessage
import com.triviadeldestino.app.game.AnswerEvent
import com.triviadeldestino.app.game.AnswerState
import com.triviadeldestino.app.game.CardId
import com.triviadeldestino.app.game.ChallengeEvent
import com.triviadeldestino.app.game.ChallengeState
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.TipoReto
import com.triviadeldestino.app.game.canReturnChallenge
import com.triviadeldestino.app.game.challengeId
import com.triviadeldestino.app.game.dailyPoints
import com.triviadeldestino.app.game.devolucionExitosa
import com.triviadeldestino.app.game.extraChallengeId
import com.triviadeldestino.app.game.remainingMs
import com.triviadeldestino.app.game.responsable
import com.triviadeldestino.app.game.scoreChallenge
import com.triviadeldestino.app.game.sentChallenge
import com.triviadeldestino.app.game.tipoReto
import com.triviadeldestino.app.nativo.Efecto
import com.triviadeldestino.app.nativo.LocalEfectos
import com.triviadeldestino.app.ui.GameUiState
import com.triviadeldestino.app.ui.GameViewModel
import com.triviadeldestino.app.ui.cards.AvatarIcon
import com.triviadeldestino.app.ui.cards.CardBack
import com.triviadeldestino.app.ui.cards.ChallengeCard
import com.triviadeldestino.app.ui.cards.Deck
import com.triviadeldestino.app.ui.cards.FlipCard
import com.triviadeldestino.app.ui.cards.TarotCard
import com.triviadeldestino.app.ui.components.CartasDelDia
import com.triviadeldestino.app.ui.components.ErrorBox
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.OrnateFrame
import com.triviadeldestino.app.ui.components.QuestionView
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.components.Variante
import com.triviadeldestino.app.ui.components.formatDuration
import com.triviadeldestino.app.ui.components.formatSeconds
import com.triviadeldestino.app.ui.components.plural
import com.triviadeldestino.app.ui.theme.Acierto
import com.triviadeldestino.app.ui.theme.Carmesi
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.LocalReduceMotion
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.Noche2
import com.triviadeldestino.app.ui.theme.Noche3
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import com.triviadeldestino.app.ui.theme.Violeta
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Momento (desde que se abre el reto en el servidor) en que su carta se voltea. */
private const val VOLTEO_MS = 1_600L

/** Tiempo mínimo de barajado, para que se vea aunque el servidor responda rápido. */
private const val BARAJADO_MIN_MS = 1_200L

/** Vueltas mínimas de la Rueda de la Fortuna antes de mostrar el resultado de la devolución. */
private const val RUEDA_MIN_MS = 2_600L

private enum class Fase { Mazo, Barajando, Carta, Tension, Volteo, Cuenta, Pregunta, Resultado }

private val C = GameConfig.DEFAULT

/** Hora del servidor que se actualiza cada 100 ms mientras `activo`. */
@Composable
private fun relojRapido(activo: Boolean): Long {
    val ahora by produceState(ServerClock.now(), activo) {
        while (activo) {
            value = ServerClock.now()
            delay(100)
        }
    }
    return ahora
}

@Composable
private fun Pantalla(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) { content() }
}

@Composable
private fun Aviso(texto: String, onInicio: () -> Unit, titulo: String? = null) {
    OrnateFrame {
        if (titulo != null) {
            Text(titulo, style = MaterialTheme.typography.headlineSmall, color = OroClaro, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
        }
        Text(texto, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        TriviaButton("Volver al inicio", onInicio, variante = Variante.Fantasma, modifier = Modifier.fillMaxWidth())
    }
}

/** Número grande de la cuenta atrás sobre la carta (3, 2, 1). */
@Composable
private fun CuentaAtras(inicioMs: Long, ahora: Long, modifier: Modifier = Modifier) {
    val n = ((C.pausaRevelacionMs - (ahora - inicioMs) + 999) / 1000).coerceIn(1, 3)
    Text(
        "$n",
        style = MaterialTheme.typography.displayLarge.copy(fontSize = 96.sp),
        color = OroClaro,
        modifier = modifier.clearAndSetSemantics { },
    )
}

// ======================= Las 3 cartas del día =======================

/**
 * Para cada carta: barajar → carta volteada (se puede usar el comodín) → "Ver la pregunta" →
 * cuenta atrás → pregunta con temporizador → resultado. Con `verN` muestra una carta ya respondida.
 */
@Composable
fun PlayScreen(
    vm: GameViewModel,
    s: GameUiState,
    revelarAlEntrar: Boolean,
    verN: Int?,
    onInicio: () -> Unit,
    onRetar: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var ocupado by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var elegida by remember { mutableStateOf<Int?>(null) }
    var enviado by remember { mutableStateOf<String?>(null) }
    var autoInicio by rememberSaveable { mutableStateOf(false) }
    var vista by rememberSaveable { mutableStateOf(verN) }

    val enJuego = s.myTodayAnswers.firstOrNull { it.estado != AnswerState.cerrada }
    val vistaCerrada = vista?.let { n -> s.myTodayAnswers.firstOrNull { it.n == n && it.estado == AnswerState.cerrada } }
    val actual: AnswerEvent? = if (ocupado == "sacar") null else enJuego ?: vistaCerrada ?: s.myTodayAnswers.lastOrNull()
    val ahora = relojRapido(ocupado != null || actual?.estado == AnswerState.abierta)
    val inicio = actual?.reveladoEnMs ?: ahora
    val restante = remainingMs(inicio, ahora)
    val pregunta = actual?.preguntaId?.let { vm.pregunta(it) }

    val fase: Fase? = when {
        // El barajado dura hasta que acaba su tiempo mínimo: así "Ver la pregunta" nunca aparece deshabilitado.
        ocupado == "sacar" -> Fase.Barajando
        actual?.estado == AnswerState.carta -> Fase.Carta
        actual?.estado == AnswerState.abierta -> if (ahora - inicio < C.pausaRevelacionMs) Fase.Cuenta else Fase.Pregunta
        actual?.estado == AnswerState.cerrada -> Fase.Resultado
        s.puedeSacarCarta -> Fase.Mazo
        else -> null
    }

    fun accion(nombre: String, bloque: suspend () -> Result<Unit>) {
        if (ocupado != null) return
        ocupado = nombre
        error = null
        scope.launch {
            bloque().onFailure { error = it.friendlyMessage() }
            ocupado = null
        }
    }

    fun sacar() {
        vista = null
        elegida = null
        accion("sacar") {
            val inicioBarajado = System.currentTimeMillis()
            vm.sacarCarta().also { delay((BARAJADO_MIN_MS - (System.currentTimeMillis() - inicioBarajado)).coerceAtLeast(0)) }
        }
    }

    fun responder(opcion: Int?) {
        val a = actual ?: return
        val clave = "${a.dia}-${a.n}"
        if (enviado == clave || fase != Fase.Pregunta) return
        enviado = clave
        elegida = opcion
        vm.responder(opcion).onFailure {
            enviado = null
            error = it.friendlyMessage("No se pudo guardar tu respuesta.")
        }
    }

    LaunchedEffect(Unit) {
        if (revelarAlEntrar && !autoInicio) {
            autoInicio = true
            if (s.online && s.puedeSacarCarta && enJuego == null) sacar()
        }
    }
    LaunchedEffect(fase, restante <= 0L) { if (fase == Fase.Pregunta && restante <= 0L) responder(null) }
    EfectosDelRitual(fase, restante, actual?.takeIf { it.estado == AnswerState.cerrada }?.correcta, actual?.carta)

    Pantalla {
        if (fase == null) {
            Aviso(
                when {
                    !s.isPlayer -> "Organizas este grupo sin jugar, así que no tienes cartas."
                    s.seasonOver -> "La temporada terminó. ¡Mira quién es el Dueño del Destino!"
                    s.myPending.isNotEmpty() -> "Tienes un reto pendiente. Respóndelo antes de sacar tu carta."
                    else -> "Ya jugaste tus cartas de hoy."
                },
                onInicio,
            )
            return@Pantalla
        }

        // Anuncio para TalkBack de la carta volteada.
        Text(
            when {
                fase == Fase.Barajando -> "Barajando el mazo…"
                fase == Fase.Carta && actual != null -> "Tu carta: ${actual.carta.nombre}, ${actual.carta.categoria}"
                fase == Fase.Cuenta -> "La pregunta aparece en unos segundos."
                else -> ""
            },
            modifier = Modifier.height(0.dp).semantics { liveRegion = LiveRegionMode.Polite },
        )

        // Durante la pregunta se oculta: con letra grande dejaría las opciones fuera de la pantalla.
        if (fase != Fase.Pregunta) CartasDelDia(s.myTodayAnswers)

        if (fase == Fase.Mazo || fase == Fase.Barajando || fase == Fase.Carta || fase == Fase.Cuenta) {
            OrnateFrame {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.width(190.dp).height(323.dp), contentAlignment = Alignment.Center) {
                        Crossfade((fase == Fase.Carta || fase == Fase.Cuenta) && actual != null, label = "carta") { volteada ->
                            if (volteada && actual != null) {
                                // La clave cambia con el comodín: la carta nueva se voltea otra vez.
                                key(actual.n, actual.carta) {
                                    FlipCard(
                                        revealed = true,
                                        back = { CardBack(Modifier.fillMaxSize()) },
                                        front = { TarotCard(actual.carta, Modifier.fillMaxSize()) },
                                        modifier = Modifier.fillMaxSize().alpha(if (fase == Fase.Cuenta) 0.35f else 1f),
                                    )
                                }
                            } else {
                                Deck(shuffling = fase == Fase.Barajando, modifier = Modifier.fillMaxSize())
                            }
                        }
                        if (fase == Fase.Cuenta) CuentaAtras(inicio, ahora)
                    }
                    Spacer(Modifier.height(16.dp))
                    when (fase) {
                        Fase.Mazo -> {
                            TriviaButton(
                                if (s.online) "Sacar carta ${s.myTodayAnswers.size + 1} de ${C.preguntasPorDia}" else "Sin conexión",
                                ::sacar,
                                enabled = s.online,
                                large = true,
                            )
                            Nota(
                                "Verás la carta antes que la pregunta: si no te gusta su categoría, puedes cambiarla con tu comodín del día.",
                                Modifier.padding(top = 10.dp),
                                center = true,
                            )
                        }
                        Fase.Barajando -> Text("El destino baraja las cartas…", color = Niebla)
                        Fase.Carta -> if (actual != null) {
                            Text(actual.carta.nombre, style = MaterialTheme.typography.headlineMedium, color = OroClaro)
                            Text(actual.carta.categoria, color = Niebla)
                            Spacer(Modifier.height(12.dp))
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                TriviaButton(
                                    "Ver la pregunta",
                                    { accion("ver") { vm.verPregunta() } },
                                    loading = ocupado == "ver",
                                    enabled = s.online && ocupado == null,
                                    large = true,
                                )
                                if (s.comodinDisponible) {
                                    TriviaButton(
                                        "Usar comodín",
                                        { accion("comodin") { vm.usarComodin() } },
                                        variante = Variante.Violeta,
                                        loading = ocupado == "comodin",
                                        enabled = s.online && ocupado == null,
                                        large = true,
                                    )
                                }
                            }
                            Nota(
                                if (s.comodinDisponible) {
                                    "Tendrás ${C.tiempoPreguntaMs / 1000} s. El comodín cambia esta carta por otra de otra categoría (uno al día)."
                                } else {
                                    "Tendrás ${C.tiempoPreguntaMs / 1000} s. Ya usaste tu comodín de hoy."
                                },
                                Modifier.padding(top = 10.dp),
                                center = true,
                            )
                        }
                        else -> Text("Concéntrate…", color = Niebla)
                    }
                    Spacer(Modifier.height(8.dp))
                    ErrorBox(error)
                }
            }
        }

        if ((fase == Fase.Pregunta || fase == Fase.Resultado) && actual != null && pregunta != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TarotCard(actual.carta, Modifier.width(84.dp))
                Column(Modifier.padding(start = 14.dp)) {
                    Text(actual.carta.nombre, style = MaterialTheme.typography.titleLarge, color = OroClaro)
                    Text("${actual.carta.categoria} · carta ${actual.n + 1} de ${C.preguntasPorDia}", color = Niebla)
                }
            }
            OrnateFrame {
                QuestionView(
                    question = pregunta,
                    remainingMs = restante,
                    selected = if (fase == Fase.Resultado) actual.opcion else elegida,
                    reveal = fase == Fase.Resultado,
                    enabled = fase == Fase.Pregunta && enviado != "${actual.dia}-${actual.n}",
                    onSelect = ::responder,
                )
                Spacer(Modifier.height(8.dp))
                ErrorBox(error)
            }
            if (fase == Fase.Resultado) {
                ResultPanel(actual, pregunta.explicacion, s, vm.puedeRetar(), onInicio, onRetar, ::sacar)
            }
        }
    }
}

@Composable
private fun Estadistica(titulo: String, valor: String, modifier: Modifier, color: androidx.compose.ui.graphics.Color = com.triviadeldestino.app.ui.theme.Pergamino) {
    Column(modifier.clip(RoundedCornerShape(12.dp)).background(Noche3.copy(alpha = 0.7f)).padding(12.dp)) {
        Text(titulo, style = MaterialTheme.typography.bodySmall, color = Niebla)
        Text(valor, style = MaterialTheme.typography.titleMedium.copy(fontFamily = com.triviadeldestino.app.ui.theme.Inter), color = color)
    }
}

@Composable
private fun Explicacion(texto: String) {
    Column(Modifier.fillMaxWidth().border(1.dp, Oro.copy(alpha = 0.2f), RoundedCornerShape(12.dp)).background(Noche.copy(alpha = 0.6f), RoundedCornerShape(12.dp)).padding(12.dp)) {
        Text("EXPLICACIÓN", style = MaterialTheme.typography.labelSmall, color = Oro)
        Text(texto)
    }
}

@Composable
private fun ResultPanel(
    a: AnswerEvent,
    explicacion: String,
    s: GameUiState,
    puedeRetar: Boolean,
    onInicio: () -> Unit,
    onRetar: () -> Unit,
    onSiguiente: () -> Unit,
) {
    val puntos = dailyPoints(a.correcta, a.tiempoMs)
    val quedan = C.preguntasPorDia - s.myTodayAnswers.size
    OrnateFrame(borderColor = if (a.correcta) Acierto.copy(alpha = 0.5f) else Error.copy(alpha = 0.4f)) {
        Text(
            when {
                a.correcta -> "¡El destino te sonríe!"
                a.opcion == null -> "Se acabó el tiempo"
                else -> "Las cartas no estaban de tu lado"
            },
            style = MaterialTheme.typography.headlineMedium,
            color = if (a.correcta) Acierto else Error,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            if (a.correcta) "+$puntos puntos" + if (puntos > C.puntosCorrecta) " (incluye +${C.bonoRapidez} por responder en menos de ${C.umbralRapidezMs / 1000} s)" else "" else "0 puntos esta vez.",
            color = if (a.correcta) OroClaro else Niebla,
            modifier = Modifier.padding(vertical = 8.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Estadistica("Tiempo", formatSeconds(a.tiempoMs.toDouble()), Modifier.weight(1f))
            Estadistica("Racha", plural(s.myRow?.rachaActual ?: 0, "acierto"), Modifier.weight(1f))
            Estadistica("Total", "${s.myRow?.puntos ?: 0} pts", Modifier.weight(1f), OroClaro)
        }
        Spacer(Modifier.height(12.dp))
        Explicacion(explicacion)
        if (puedeRetar) {
            Spacer(Modifier.height(12.dp))
            Column(Modifier.fillMaxWidth().border(1.dp, Carmesi, RoundedCornerShape(12.dp)).background(Carmesi.copy(alpha = 0.25f), RoundedCornerShape(12.dp)).padding(12.dp)) {
                Text("¡Reto desbloqueado!", style = MaterialTheme.typography.titleMedium, color = OroClaro)
                Nota("Llevas ${C.aciertosParaRetar} aciertos hoy. Envía una pregunta difícil a alguien del grupo: si falla, +${C.puntosReto} para ti; si acierta, se los lleva.")
                Spacer(Modifier.height(8.dp))
                TriviaButton("Lanzar un reto", onRetar, variante = Variante.Violeta)
            }
        }
        Spacer(Modifier.height(12.dp))
        if (s.puedeSacarCarta) {
            TriviaButton(
                "Siguiente carta (${s.myTodayAnswers.size + 1} de ${C.preguntasPorDia})",
                onSiguiente,
                enabled = s.online,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        TriviaButton("Volver al inicio", onInicio, variante = Variante.Fantasma, modifier = Modifier.fillMaxWidth())
        val faltan = s.group?.let { formatDuration(com.triviadeldestino.app.game.msUntilNextDay(it.fechaInicioMs, s.now)) }.orEmpty()
        Nota(
            when {
                quedan == 0 -> "Jugaste tus ${C.preguntasPorDia} cartas de hoy. Las próximas llegan en $faltan."
                s.myPending.isNotEmpty() -> "Tienes un reto pendiente: respóndelo para sacar tu siguiente carta."
                quedan == 1 -> "Te queda 1 carta hoy."
                else -> "Te quedan $quedan cartas hoy."
            },
            Modifier.padding(top = 10.dp),
        )
    }
}

// ======================= Lanzar un reto =======================

@Composable
fun SendChallengeScreen(vm: GameViewModel, s: GameUiState, onInicio: () -> Unit) {
    val scope = rememberCoroutineScope()
    var elegido by rememberSaveable { mutableStateOf<String?>(null) }
    var enviando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val lanzado = s.uid?.let { sentChallenge(it, s.day, s.challenges) }

    Pantalla {
        if (lanzado != null) {
            val retado = s.apodoDe(lanzado.para)
            OrnateFrame {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    ChallengeCard(null, Modifier.width(150.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("Reto lanzado a $retado", style = MaterialTheme.typography.headlineMedium, color = OroClaro, textAlign = TextAlign.Center)
                    Text(
                        textoMiReto(lanzado, s),
                        color = Niebla,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 10.dp),
                    )
                    TriviaButton("Volver al inicio", onInicio, variante = Variante.Fantasma)
                }
            }
            return@Pantalla
        }
        if (!vm.puedeRetar()) {
            Aviso("El reto del día se desbloquea al acertar ${C.aciertosParaRetar} preguntas.", onInicio)
            return@Pantalla
        }

        Text("Lanza tu reto", style = MaterialTheme.typography.headlineLarge, color = OroClaro, modifier = Modifier.semantics { heading() })
        Nota("Elige a quién enviarle una pregunta difícil. Si falla, +${C.puntosReto} para ti; si acierta, se los lleva.")
        val disponibles = vm.retables()
        val candidatos = s.standings.filter { it.uid != s.uid }
        OrnateFrame {
            if (candidatos.isEmpty()) {
                Nota("Todavía no hay nadie más en el grupo. ¡Invita a alguien!", center = true, modifier = Modifier.fillMaxWidth())
            }
            Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                candidatos.forEach { r ->
                    val puede = r.uid in disponibles
                    val activo = elegido == r.uid
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, if (activo) Oro else Oro.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                            .background(if (activo) Violeta.copy(alpha = 0.4f) else Noche2.copy(alpha = 0.7f))
                            .selectable(selected = activo, enabled = puede, role = Role.RadioButton, onClick = { elegido = r.uid })
                            .graphicsLayer { alpha = if (puede) 1f else 0.45f }
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        AvatarIcon(r.avatar, Modifier.width(38.dp), decorative = true)
                        Column(Modifier.padding(start = 10.dp)) {
                            Text(r.apodo + if (r.esBot) "  · bot" else "")
                            Nota(if (puede) "${r.posicion}.º · ${r.puntos} pts" else "Ya recibió su reto de hoy")
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            ErrorBox(error)
            Spacer(Modifier.height(8.dp))
            TriviaButton(
                elegido?.let { "Retar a ${s.apodoDe(it)}" } ?: "Elige a alguien",
                {
                    val para = elegido ?: return@TriviaButton
                    enviando = true
                    error = null
                    scope.launch {
                        vm.retar(para).onFailure { error = it.friendlyMessage() }
                        enviando = false
                    }
                },
                enabled = elegido != null && s.online,
                loading = enviando,
                large = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Cómo va el reto que lancé (igual que en la web). */
fun textoMiReto(c: ChallengeEvent, s: GameUiState): String {
    val quien = s.apodoDe(c.para)
    return when (tipoReto(c)) {
        TipoReto.reto -> when {
            c.estado == ChallengeState.devuelto -> "$quien te lo devolvió: la Rueda de la Fortuna decide…"
            c.estado != ChallengeState.resuelto -> "Retaste a $quien: aún no responde. Si falla, te llevas +${C.puntosReto}; si acierta, se los lleva."
            c.correcta == true -> "Retaste a $quien: acertó y se llevó +${C.puntosReto}."
            else -> "Retaste a $quien: ¡falló! Ganaste +${C.puntosReto}."
        }
        TipoReto.devuelto -> when {
            c.estado != ChallengeState.resuelto -> "$quien te devolvió el reto y le salió bien: debes responderlo tú (sin premio; −${C.penalizacionReto} si fallas)."
            c.correcta == true -> "$quien te devolvió el reto y lo respondiste bien: nadie gana ni pierde."
            else -> "$quien te devolvió el reto y lo fallaste: −${C.penalizacionReto}."
        }
        else -> "$quien intentó devolverte el reto y le salió mal: responde dos preguntas. Si falla las dos, ganas +${C.puntosReto}."
    }
}

// ======================= Responder o devolver un reto =======================

private fun tituloReto(tipo: TipoReto, retador: String, retado: String) = when (tipo) {
    TipoReto.reto -> "Reto de $retador"
    TipoReto.devuelto -> "Reto devuelto por $retado"
    TipoReto.doble -> "Doble reto · 1 de 2"
    TipoReto.extra -> "Doble reto · 2 de 2"
}

private fun introReto(tipo: TipoReto, retador: String, retado: String): Pair<String, String> = when (tipo) {
    TipoReto.reto -> "$retador te desafía" to
        "Una pregunta difícil, ${C.tiempoPreguntaMs / 1000} segundos. Si aciertas ganas +${C.puntosReto}; si fallas pierdes ${C.penalizacionReto} y $retador gana +${C.puntosReto}."
    TipoReto.devuelto -> "$retado te devolvió tu reto" to
        "La Rueda de la Fortuna le sonrió: ahora debes responderlo tú. Si aciertas no ganas nada; si fallas pierdes ${C.penalizacionReto}."
    TipoReto.doble -> "Doble reto: pregunta 1 de 2" to
        "La devolución falló. Responde dos preguntas: si aciertas alguna ganas +${C.puntosReto} (una sola vez) y cada fallo resta ${C.penalizacionReto}."
    TipoReto.extra -> "Doble reto: pregunta 2 de 2" to
        "La última del doble reto. Recuerda: +${C.puntosReto} si aciertas alguna de las dos y −${C.penalizacionReto} por cada fallo."
}

/**
 * Una pregunta de reto: la que te lanzaron, la que te devolvieron o las dos del doble reto.
 * Un reto recibido también se puede devolver: la Rueda de la Fortuna gira hasta que el servidor
 * confirma la hora, y el resultado se lee del reto en vivo (el mismo que aplican las reglas).
 */
@Composable
fun ChallengePlayScreen(vm: GameViewModel, s: GameUiState, id: String, onInicio: () -> Unit, onReto: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var abriendo by remember { mutableStateOf(false) }
    var error by remember(id) { mutableStateOf<String?>(null) }
    var elegida by remember(id) { mutableStateOf<Int?>(null) }
    var enviado by remember(id) { mutableStateOf(false) }
    var ruedaDesde by rememberSaveable { mutableStateOf<Long?>(null) }
    var ruedaVista by rememberSaveable { mutableStateOf(false) }
    val reducir = LocalReduceMotion.current
    val uid = s.uid

    val reto = s.challenges.firstOrNull { it.id == id }
    val girando = ruedaDesde != null && !ruedaVista
    val ahora = relojRapido(abriendo || reto?.estado == ChallengeState.abierto || girando)
    val inicio = reto?.abiertoEnMs ?: ahora
    val pregunta = reto?.let { vm.pregunta(it.preguntaId) }
    val restante = remainingMs(inicio, ahora)
    val t = ahora - inicio
    val fase: Fase? = when {
        reto == null -> null
        reto.estado == ChallengeState.resuelto -> Fase.Resultado
        reto.estado == ChallengeState.abierto -> when {
            t < VOLTEO_MS -> Fase.Tension
            t < C.pausaRevelacionMs -> Fase.Volteo
            else -> Fase.Pregunta
        }
        else -> Fase.Mazo
    }

    fun responder(opcion: Int?) {
        if (enviado || fase != Fase.Pregunta || reto == null) return
        enviado = true
        elegida = opcion
        vm.responderReto(reto.id, opcion).onFailure {
            enviado = false
            error = it.friendlyMessage("No se pudo guardar tu respuesta.")
        }
    }
    LaunchedEffect(fase, restante <= 0L) { if (fase == Fase.Pregunta && restante <= 0L) responder(null) }
    EfectosDelRitual(fase, restante, reto?.takeIf { it.estado == ChallengeState.resuelto }?.correcta, reto?.carta)

    Pantalla {
        if (reto == null || pregunta == null || uid == null) {
            Aviso("Este reto no existe o ya no está disponible.", onInicio)
            return@Pantalla
        }
        val tipo = tipoReto(reto)
        val retador = s.apodoDe(reto.de)
        val retado = s.apodoDe(reto.para)

        // ---------- la Rueda de la Fortuna (devolución) ----------
        if (girando) {
            val resultado = reto.devueltoEnMs?.let { devolucionExitosa(it) }
            val listo = resultado != null && ahora - ruedaDesde!! >= RUEDA_MIN_MS
            RuedaDeLaFortuna(
                exito = if (listo) resultado else null,
                retador = retador,
                error = error,
                onSeguir = { if (resultado == true) onInicio() else ruedaVista = true },
            )
            return@Pantalla
        }

        if (responsable(reto) != uid) {
            when {
                reto.para == uid && tipo == TipoReto.devuelto -> Aviso(
                    when {
                        reto.estado != ChallengeState.resuelto -> "Todavía no responde. Si falla, pierde ${C.penalizacionReto} puntos."
                        reto.correcta == true -> "Lo respondió bien: nadie gana ni pierde puntos."
                        else -> "¡Falló! Pierde ${C.penalizacionReto} puntos."
                    },
                    onInicio,
                    titulo = "Le devolviste el reto a $retador",
                )
                reto.para == uid && reto.estado == ChallengeState.devuelto -> Aviso("La Rueda de la Fortuna sigue girando… Espera un momento.", onInicio)
                else -> Aviso("Este reto es para otra persona.", onInicio)
            }
            return@Pantalla
        }

        if (fase == Fase.Mazo || fase == Fase.Tension || fase == Fase.Volteo) {
            val temblor = rememberInfiniteTransition(label = "temblor").animateFloat(-3f, 3f, infiniteRepeatable(tween(90), RepeatMode.Reverse), label = "giro")
            OrnateFrame(borderColor = Carmesi.copy(alpha = 0.8f)) {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.width(190.dp).height(323.dp)) {
                        Crossfade(fase == Fase.Volteo, label = "reto") { volteo ->
                            if (volteo) {
                                FlipCard(
                                    revealed = true,
                                    back = { ChallengeCard(retador, Modifier.fillMaxSize()) },
                                    front = { TarotCard(reto.carta, Modifier.fillMaxSize()) },
                                    modifier = Modifier.fillMaxSize(),
                                )
                            } else {
                                ChallengeCard(
                                    if (tipo == TipoReto.devuelto) retado else retador,
                                    Modifier.fillMaxSize().graphicsLayer { rotationZ = if (fase == Fase.Tension && !reducir) temblor.value else 0f },
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    if (fase == Fase.Mazo) {
                        val (titulo, detalle) = introReto(tipo, retador, retado)
                        Text(titulo, style = MaterialTheme.typography.headlineMedium, color = OroClaro, textAlign = TextAlign.Center)
                        Text(detalle, color = Niebla, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 10.dp))
                        val puedeDevolver = canReturnChallenge(reto, uid)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            TriviaButton(
                                when {
                                    !s.online -> "Sin conexión"
                                    tipo == TipoReto.reto -> "Aceptar el reto"
                                    else -> "Ver la pregunta"
                                },
                                {
                                    abriendo = true
                                    error = null
                                    scope.launch {
                                        vm.abrirReto(reto.id).onFailure { error = it.friendlyMessage() }
                                        abriendo = false
                                    }
                                },
                                loading = abriendo,
                                enabled = s.online,
                                large = true,
                            )
                            if (puedeDevolver) {
                                TriviaButton(
                                    "Devolver el reto",
                                    {
                                        error = null
                                        ruedaDesde = ServerClock.now()
                                        ruedaVista = false
                                        scope.launch {
                                            vm.devolverReto(reto.id).onFailure {
                                                ruedaDesde = null
                                                error = it.friendlyMessage()
                                            }
                                        }
                                    },
                                    variante = Variante.Violeta,
                                    enabled = s.online && !abriendo,
                                    large = true,
                                )
                            }
                        }
                        if (puedeDevolver) {
                            Nota(
                                "Devolverlo tiene un ${C.porcentajeDevolucion} % de éxito: si sale bien, le toca a $retador responderla (sin premio, y pierde ${C.penalizacionReto} si falla). " +
                                    "Si sale mal, responderás dos preguntas: +${C.puntosReto} si aciertas alguna y −${C.penalizacionReto} por cada fallo.",
                                Modifier.padding(top = 10.dp),
                                center = true,
                            )
                        }
                    } else if (fase == Fase.Volteo) {
                        Text(reto.carta.nombre, style = MaterialTheme.typography.headlineMedium, color = OroClaro)
                        Text(reto.carta.categoria, color = Niebla)
                    }
                    ErrorBox(error)
                }
            }
        }

        if (fase == Fase.Pregunta || fase == Fase.Resultado) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TarotCard(reto.carta, Modifier.width(84.dp))
                Column(Modifier.padding(start = 14.dp)) {
                    Text(tituloReto(tipo, retador, retado), style = MaterialTheme.typography.titleLarge, color = OroClaro)
                    Text("${reto.carta.nombre} · ${reto.carta.categoria}", color = Niebla)
                }
            }
            OrnateFrame(borderColor = Carmesi.copy(alpha = 0.8f)) {
                QuestionView(pregunta, restante, elegida, fase == Fase.Resultado, fase == Fase.Pregunta && !enviado, ::responder)
                ErrorBox(error)
            }
        }

        if (fase == Fase.Resultado) {
            val base = if (reto.extra) s.challenges.firstOrNull { it.id == challengeId(reto.para, reto.dia) } else reto
            val extra = base?.let { b -> s.challenges.firstOrNull { it.id == extraChallengeId(b.para, b.dia) } }
            val otra = when (tipo) {
                TipoReto.doble -> extra
                TipoReto.extra -> base
                else -> null
            }
            val falta = otra != null && otra.estado != ChallengeState.resuelto
            val misPuntos = base?.let { b -> scoreChallenge(b, extra, false).filter { it.uid == uid }.sumOf { it.puntos } } ?: 0
            val resumen = when {
                tipo == TipoReto.reto -> if (reto.correcta == true) "+${C.puntosReto} puntos para ti." else "Pierdes ${C.penalizacionReto} puntos y $retador se lleva +${C.puntosReto}."
                tipo == TipoReto.devuelto -> if (reto.correcta == true) "Te salvaste: no pierdes nada." else "Pierdes ${C.penalizacionReto} puntos."
                falta -> if (reto.correcta == true) {
                    "¡Acertaste! Ya tienes los +${C.puntosReto} del reto. Falta la otra pregunta (si la fallas, −${C.penalizacionReto})."
                } else {
                    "Fallaste esta (−${C.penalizacionReto}). Si aciertas la otra, ganas +${C.puntosReto}."
                }
                else -> {
                    val ganoRetador = base?.correcta == false && extra?.correcta == false
                    "Doble reto terminado: ${if (misPuntos > 0) "+" else ""}$misPuntos puntos para ti" +
                        (if (ganoRetador) " y +${C.puntosReto} para $retador" else "") + "."
                }
            }
            OrnateFrame(borderColor = if (reto.correcta == true) Acierto.copy(alpha = 0.5f) else Error.copy(alpha = 0.4f)) {
                Text(
                    if (reto.correcta == true) "¡Venciste el reto!" else "El reto te venció",
                    style = MaterialTheme.typography.headlineMedium,
                    color = if (reto.correcta == true) Acierto else Error,
                    modifier = Modifier.semantics { heading() },
                )
                Text(resumen, color = if (reto.correcta == true) OroClaro else Niebla, modifier = Modifier.padding(vertical = 8.dp))
                Explicacion(pregunta.explicacion)
                Spacer(Modifier.height(12.dp))
                if (falta && otra != null) {
                    TriviaButton("Siguiente pregunta", { onReto(otra.id) }, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                }
                TriviaButton("Volver al inicio", onInicio, variante = Variante.Fantasma, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/** La Rueda de la Fortuna gira mientras el servidor decide la devolución. */
@Composable
private fun RuedaDeLaFortuna(exito: Boolean?, retador: String, error: String?, onSeguir: () -> Unit) {
    val reducir = LocalReduceMotion.current
    val efectos = LocalEfectos.current
    val vista = LocalView.current
    OrnateFrame {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                when (exito) {
                    null -> "La Rueda de la Fortuna gira…"
                    true -> "La devolución salió bien."
                    false -> "La devolución salió mal."
                },
                modifier = Modifier.height(0.dp).semantics { liveRegion = LiveRegionMode.Polite },
            )
            Box(Modifier.width(190.dp).height(323.dp), contentAlignment = Alignment.Center) {
                if (exito == null) {
                    val giro = rememberInfiniteTransition(label = "rueda").animateFloat(0f, 360f, infiniteRepeatable(tween(800, easing = LinearEasing)), label = "giro")
                    TarotCard(CardId.RUEDA, Modifier.fillMaxSize().graphicsLayer { rotationZ = if (reducir) 0f else giro.value })
                } else {
                    // Al conocerse el resultado, una carta nueva se asienta derecha.
                    val asiento = remember { Animatable(if (reducir) 0f else -30f) }
                    LaunchedEffect(Unit) {
                        efectos?.reproducir(if (exito) Efecto.Acierto else Efecto.Fallo, vista)
                        asiento.animateTo(0f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
                    }
                    TarotCard(CardId.RUEDA, Modifier.fillMaxSize().graphicsLayer { rotationZ = asiento.value })
                }
            }
            Spacer(Modifier.height(16.dp))
            when (exito) {
                null -> Text("La Rueda de la Fortuna decide…", color = Niebla)
                else -> {
                    Text(
                        if (exito) "¡La fortuna te sonríe!" else "La fortuna te da la espalda",
                        style = MaterialTheme.typography.headlineMedium,
                        color = if (exito) Acierto else Error,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        if (exito) {
                            "El reto vuelve a $retador: tendrá que responderlo sin premio, y si falla pierde ${C.penalizacionReto}. Tú quedas libre."
                        } else {
                            "Ahora te toca un doble reto: dos preguntas difíciles. +${C.puntosReto} si aciertas alguna; −${C.penalizacionReto} por cada fallo."
                        },
                        color = Niebla,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 10.dp),
                    )
                    TriviaButton(if (exito) "Volver al inicio" else "Empezar el doble reto", onSeguir, large = true)
                }
            }
            ErrorBox(error)
        }
    }
}

/** Sonido y vibración del ritual: carta al voltearse, tic en los últimos 5 s y resultado al resolver. */
@Composable
private fun EfectosDelRitual(fase: Fase?, restanteMs: Long, correcta: Boolean?, carta: CardId?) {
    val efectos = LocalEfectos.current ?: return
    val vista = LocalView.current
    // Si la pantalla se abre con el resultado ya resuelto, no vuelve a sonar.
    var resultadoSonado by remember { mutableStateOf(fase == Fase.Resultado) }
    val segundos = ((restanteMs + 999) / 1000).toInt()
    LaunchedEffect(fase, carta) {
        when {
            fase == Fase.Carta || fase == Fase.Volteo -> efectos.reproducir(Efecto.Carta, vista)
            fase == Fase.Resultado && !resultadoSonado && correcta != null -> {
                resultadoSonado = true
                efectos.reproducir(if (correcta) Efecto.Acierto else Efecto.Fallo, vista)
            }
            fase == Fase.Pregunta -> resultadoSonado = false
        }
    }
    LaunchedEffect(segundos, fase) { if (fase == Fase.Pregunta && segundos in 1..5) efectos.reproducir(Efecto.Tic, vista) }
}
