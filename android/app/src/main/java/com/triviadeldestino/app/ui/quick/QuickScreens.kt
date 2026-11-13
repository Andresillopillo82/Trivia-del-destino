package com.triviadeldestino.app.ui.quick

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.triviadeldestino.app.data.UserProfile
import com.triviadeldestino.app.data.friendlyMessage
import com.triviadeldestino.app.game.CardId
import com.triviadeldestino.app.game.QuickMatchConfig
import com.triviadeldestino.app.game.QuickPlayer
import com.triviadeldestino.app.game.QuickRoom
import com.triviadeldestino.app.game.QuickStatus
import com.triviadeldestino.app.game.Question
import com.triviadeldestino.app.game.canStart
import com.triviadeldestino.app.game.quickCodeFrom
import com.triviadeldestino.app.game.quickWinners
import com.triviadeldestino.app.game.rankQuick
import com.triviadeldestino.app.game.remainingMs
import com.triviadeldestino.app.game.stillPlaying
import com.triviadeldestino.app.nativo.Efecto
import com.triviadeldestino.app.nativo.LocalEfectos
import com.triviadeldestino.app.ui.cards.AvatarIcon
import com.triviadeldestino.app.ui.cards.TarotCard
import com.triviadeldestino.app.ui.components.ErrorBox
import com.triviadeldestino.app.ui.components.LoadingScreen
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.OrnateFrame
import com.triviadeldestino.app.ui.components.StatusScreen
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.components.TriviaTextField
import com.triviadeldestino.app.ui.components.Variante
import com.triviadeldestino.app.ui.components.WEB_URL
import com.triviadeldestino.app.ui.components.circuloLetra
import com.triviadeldestino.app.ui.components.formatDuration
import com.triviadeldestino.app.ui.components.plural
import com.triviadeldestino.app.ui.components.qrBitmap
import com.triviadeldestino.app.ui.theme.Acierto
import com.triviadeldestino.app.ui.theme.Cinzel
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.LocalReduceMotion
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche2
import com.triviadeldestino.app.ui.theme.Noche3
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import com.triviadeldestino.app.ui.theme.OroOscuro
import com.triviadeldestino.app.ui.theme.Pergamino
import com.triviadeldestino.app.ui.theme.Violeta
import com.triviadeldestino.app.ui.theme.VioletaClaro
import kotlinx.coroutines.launch

/** Enlace para entrar a una sala (lo lleva el QR; sirve también en la web). */
fun quickJoinUrl(code: String) = "$WEB_URL/rapida/$code"

private val Letras = listOf("A", "B", "C", "D")

// ======================================================================== accesos

/** Acceso a la Partida Rápida desde Inicio (con o sin grupo). */
@Composable
fun QuickMatchBanner(sinGrupo: Boolean, onClick: () -> Unit) {
    OrnateFrame {
        Text("Partida Rápida", style = MaterialTheme.typography.titleMedium, color = OroClaro, modifier = Modifier.semantics { heading() })
        Nota(
            "${QuickMatchConfig.DEFAULT.startSeconds} s contrarreloj en una sala con código. " +
                if (sinGrupo) "No hace falta grupo." else "Aparte del Modo Destino: no cuenta para la clasificación.",
            Modifier.padding(vertical = 8.dp),
        )
        TriviaButton("Crear sala o unirme", onClick, variante = Variante.Violeta, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Pantalla(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}

@Composable
private fun Titulo(texto: String, modifier: Modifier = Modifier, size: Int = 30) {
    Text(
        texto,
        fontFamily = Cinzel,
        fontWeight = FontWeight.Bold,
        fontSize = size.sp,
        lineHeight = (size * 1.2).sp,
        color = OroClaro,
        textAlign = TextAlign.Center,
        modifier = modifier.fillMaxWidth().semantics { heading() },
    )
}

// ======================================================================== menú

@Composable
fun QuickMenuScreen(vm: QuickViewModel, perfil: UserProfile, online: Boolean, onSala: (String) -> Unit, onEscanear: () -> Unit, onVolver: () -> Unit) {
    var hostPlays by rememberSaveable { mutableStateOf(true) }
    var codigo by rememberSaveable { mutableStateOf("") }
    var errorCrear by remember { mutableStateOf<String?>(null) }
    var errorUnir by remember { mutableStateOf<String?>(null) }
    var creando by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val cfg = QuickMatchConfig.DEFAULT
    BackHandler(onBack = onVolver)

    fun unir() {
        val code = quickCodeFrom(codigo)
        if (code == null) {
            errorUnir = "El código tiene 5 caracteres: letras y números (sin 0, O, 1 ni I)."
            return
        }
        onSala(code)
    }

    Pantalla {
        TextButton(onClick = onVolver) { Text("← Inicio", color = Niebla) }
        Titulo("Partida Rápida", size = 34)
        Nota(
            "${cfg.startSeconds} segundos para cada uno. Acierto +${cfg.correctBonus} s, fallo −${cfg.wrongPenalty} s. Gana quien más acierte. " +
                "Sin grupos ni clasificaciones: la sala desaparece al cerrarla.",
            center = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OrnateFrame(title = "Crear sala") {
            listOf(true to ("Participo" to "Juegas desde este teléfono."), false to ("Solo pantalla" to "Este teléfono proyecta la sala; tú no juegas."))
                .forEach { (valor, textos) ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, if (hostPlays == valor) Oro else Oro.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                            .selectable(selected = hostPlays == valor, role = Role.RadioButton, onClick = { hostPlays = valor })
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = hostPlays == valor, onClick = null, colors = RadioButtonDefaults.colors(selectedColor = Oro))
                        Column(Modifier.padding(start = 8.dp)) {
                            Text(textos.first, fontWeight = FontWeight.SemiBold)
                            Nota(textos.second)
                        }
                    }
                }
            Spacer(Modifier.height(8.dp))
            ErrorBox(errorCrear)
            TriviaButton(
                "Crear sala",
                onClick = {
                    creando = true
                    errorCrear = null
                    scope.launch {
                        vm.crear(perfil.uid, perfil.apodo, perfil.avatar, hostPlays)
                            .onSuccess(onSala)
                            .onFailure { errorCrear = it.friendlyMessage() }
                        creando = false
                    }
                },
                loading = creando,
                enabled = online,
                large = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }
        OrnateFrame(title = "Unirme con código") {
            TriviaTextField(
                value = codigo,
                onValueChange = { codigo = it },
                label = "Código de la sala",
                placeholder = "ABCDE",
                mayusculas = true,
                maxLength = 7,
                error = errorUnir,
                textStyle = MaterialTheme.typography.headlineMedium.copy(letterSpacing = 8.sp, textAlign = TextAlign.Center),
                onDone = ::unir,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TriviaButton("Unirme", ::unir, variante = Variante.Violeta, enabled = online, modifier = Modifier.weight(1f))
                TriviaButton("Escanear QR", onEscanear, variante = Variante.Fantasma)
            }
        }
        if (!online) Nota("Sin conexión: la Partida Rápida necesita internet.", center = true, color = Error, modifier = Modifier.fillMaxWidth())
    }
}

// ======================================================================== sala

@Composable
fun QuickRoomScreen(vm: QuickViewModel, s: QuickUiState, onMenu: () -> Unit, onInicio: () -> Unit) {
    var confirmarCierre by remember { mutableStateOf(false) }
    val room = s.room
    BackHandler(enabled = !s.jugando) { onMenu() }
    // Durante la partida, «atrás» no hace nada: el reloj no se pausa.
    BackHandler(enabled = s.jugando) {}

    when {
        !s.roomLoaded -> return LoadingScreen("Buscando la sala…")
        room == null -> return StatusScreen("La sala se cerró") {
            Nota("El anfitrión cerró la sala o el código no existe.", center = true)
            TriviaButton("Volver a Partida Rápida", onMenu, variante = Variante.Fantasma)
        }
        s.expirada -> return StatusScreen("Esta sala caducó") {
            Nota("Las salas duran 6 horas. Crea una nueva para seguir jugando.", center = true)
            TriviaButton("Volver a Partida Rápida", onMenu, variante = Variante.Fantasma)
        }
    }
    room!!

    if (confirmarCierre) {
        AlertDialog(
            onDismissRequest = { confirmarCierre = false },
            title = { Text("¿Cerrar la sala?") },
            text = { Text("Se borran la sala y sus jugadores. No queda ningún historial.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmarCierre = false
                    vm.cerrarSala(onMenu)
                }) { Text("Cerrar sala", color = Error) }
            },
            dismissButton = { TextButton(onClick = { confirmarCierre = false }) { Text("Cancelar", color = OroClaro) } },
            containerColor = Noche2,
        )
    }
    val botonCerrar: @Composable () -> Unit = { TriviaButton("Cerrar sala", { confirmarCierre = true }, variante = Variante.Peligro) }

    // Anfitrión en «Solo pantalla»: proyecta la sala y la dirige.
    if (s.isHost && !room.hostPlays) {
        Proyeccion(s) {
            when {
                s.terminada -> {
                    TriviaButton("Revancha", vm::revancha, loading = s.busy == "revancha", large = true)
                    botonCerrar()
                }
                room.status == QuickStatus.playing -> TriviaButton("Terminar ahora", vm::terminarAhora, variante = Variante.Violeta, loading = s.busy == "terminar")
                else -> {
                    BotonesLobby(vm, s)
                    botonCerrar()
                }
            }
        }
        return
    }

    when {
        s.jugando -> Juego(vm, s)
        s.terminada -> Resultados(vm, s, botonCerrar, onInicio)
        room.status == QuickStatus.playing -> Espera(vm, s)
        else -> Lobby(vm, s, botonCerrar, onMenu)
    }
}

@Composable
private fun BotonesLobby(vm: QuickViewModel, s: QuickUiState) {
    val room = s.room ?: return
    val bots = s.players.count { it.esBot }
    TriviaButton("Iniciar", vm::iniciar, enabled = canStart(room, s.players), loading = s.busy == "iniciar", large = true)
    TriviaButton(
        "Añadir bot ($bots/${room.config.maxBots})",
        vm::anadirBot,
        variante = Variante.Violeta,
        enabled = bots < room.config.maxBots,
        loading = s.busy == "bot",
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Lobby(vm: QuickViewModel, s: QuickUiState, botonCerrar: @Composable () -> Unit, onMenu: () -> Unit) {
    val room = s.room ?: return
    Pantalla {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onMenu) { Text("← Salir", color = Niebla) }
            Spacer(Modifier.weight(1f))
            Text("Partida Rápida", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = OroClaro)
        }
        OrnateFrame { CodigoSala(room.code) }
        OrnateFrame {
            Text(
                plural(s.players.size, "jugador", "jugadores") + " en la sala" + if (room.round > 1) " · revancha ${room.round - 1}" else "",
                fontFamily = Cinzel,
                color = OroClaro,
                fontSize = 18.sp,
                modifier = Modifier.padding(bottom = 10.dp),
            )
            ListaJugadores(s.players, s.uid, onRemove = if (s.isHost) vm::sacar else null)
            Nota(
                "${room.config.startSeconds} s para cada uno: acierto +${room.config.correctBonus} s, fallo −${room.config.wrongPenalty} s. " +
                    "Gana quien más acierte (desempate: menos fallos).",
                Modifier.padding(top = 10.dp),
            )
        }
        ErrorBox(s.joinError ?: s.error)
        if (s.isHost) {
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                BotonesLobby(vm, s)
                botonCerrar()
            }
            Nota("Para proyectar en una PC, abre ${WEB_URL.removePrefix("https://")}/sala/${room.code}/pantalla", center = true, modifier = Modifier.fillMaxWidth())
        } else {
            Text(
                if (s.yo != null) "Estás dentro. Espera a que el anfitrión pulse «Iniciar»." else "Entrando a la sala…",
                color = Niebla,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
            )
            TriviaButton("Salir", { vm.salirDelLobby(onMenu) }, variante = Variante.Fantasma, modifier = Modifier.align(Alignment.CenterHorizontally))
        }
    }
}

// ---------------------------------------------------------------- juego

@Composable
private fun Juego(vm: QuickViewModel, s: QuickUiState) {
    val room = s.room ?: return
    val p = s.play ?: return
    val reducir = LocalReduceMotion.current
    val efectos = LocalEfectos.current
    val vista = LocalView.current
    LaunchedEffect(Unit) {
        vm.efectos.collect { bien -> efectos?.reproducir(if (bien) Efecto.Acierto else Efecto.Fallo, vista) }
    }
    val clock = p.clock
    if (clock == null) {
        val n = (3 - ((p.now - p.inicio) / 1000).toInt()).coerceAtLeast(1)
        Box(Modifier.fillMaxSize().semantics { liveRegion = LiveRegionMode.Assertive; contentDescription = "La partida empieza en $n" }, contentAlignment = Alignment.Center) {
            AnimatedContent(n, transitionSpec = { (scaleIn(initialScale = if (reducir) 1f else 2f) + fadeIn()) togetherWith fadeOut() }, label = "cuenta") {
                Text("$it", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 120.sp, color = OroClaro)
            }
        }
        return
    }
    val q = p.pregunta ?: return
    val cfg = room.config
    val total = maxOf(cfg.startSeconds, cfg.maxSeconds ?: cfg.startSeconds) * 1000L
    val restante = remainingMs(clock, p.now)
    val temblor = remember { Animatable(0f) }
    LaunchedEffect(p.temblor) {
        if (p.temblor > 0 && !reducir) {
            for (x in listOf(-8f, 8f, -5f, 5f, 0f)) temblor.animateTo(x, tween(50))
        }
    }

    Pantalla {
        Box(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Contador("ACIERTOS", clock.correctas, Acierto, Alignment.Start)
                Box(Modifier.weight(1f).graphicsLayer { translationX = temblor.value * density }, contentAlignment = Alignment.Center) {
                    TimeRing(restante, total)
                }
                Contador("FALLOS", clock.falladas, Error, Alignment.End)
            }
            // +2 s / −2 s flotantes
            p.flotantes.forEach { f -> FlotanteTexto(f, cfg, reducir, Modifier.align(Alignment.TopCenter)) }
        }
        OrnateFrame {
            InsigniaCarta(q)
            Spacer(Modifier.height(8.dp))
            Text(
                q.pregunta,
                style = MaterialTheme.typography.titleLarge.copy(fontFamily = com.triviadeldestino.app.ui.theme.Inter, fontWeight = FontWeight.SemiBold),
                color = Pergamino,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        q.opciones.forEachIndexed { i, op ->
            val (borde, fondo, texto) = when {
                p.elegida != null && i == q.respuestaCorrecta -> Triple(Acierto, Acierto.copy(alpha = 0.15f), Acierto)
                p.elegida == i -> Triple(Error, Error.copy(alpha = 0.15f), Error)
                else -> Triple(Oro.copy(alpha = 0.3f), Noche2.copy(alpha = 0.8f), Pergamino)
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, borde, RoundedCornerShape(14.dp))
                    .background(fondo)
                    .clickable(enabled = p.elegida == null, role = Role.Button) { vm.responder(i) }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.border(1.dp, Oro.copy(alpha = 0.5f), CircleShape).circuloLetra().padding(4.dp), contentAlignment = Alignment.Center) {
                    Text(Letras[i], fontFamily = Cinzel, color = OroClaro, fontSize = 14.sp)
                }
                Text(op, color = texto, fontSize = 18.sp, modifier = Modifier.weight(1f).padding(start = 12.dp))
            }
        }
        Text(
            when {
                p.elegida == null -> ""
                p.elegida == q.respuestaCorrecta -> "¡Correcta! +${cfg.correctBonus} segundos"
                else -> "Fallaste. −${cfg.wrongPenalty} segundos"
            },
            modifier = Modifier.size(1.dp).semantics { liveRegion = LiveRegionMode.Polite },
            color = Color.Transparent,
        )
    }
}

@Composable
private fun Contador(titulo: String, valor: Int, color: Color, alineacion: Alignment.Horizontal) {
    Column(horizontalAlignment = alineacion, modifier = Modifier.semantics(mergeDescendants = true) {}) {
        Text(titulo, style = MaterialTheme.typography.labelSmall, color = Niebla, letterSpacing = 2.sp)
        Text("$valor", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 36.sp, color = color)
    }
}

@Composable
private fun FlotanteTexto(f: Flotante, cfg: QuickMatchConfig, reducir: Boolean, modifier: Modifier) {
    val avance = remember(f.id) { Animatable(0f) }
    LaunchedEffect(f.id) { avance.animateTo(1f, tween(900)) }
    Text(
        if (f.bien) "+${cfg.correctBonus} s" else "−${cfg.wrongPenalty} s",
        fontFamily = Cinzel,
        fontWeight = FontWeight.Bold,
        fontSize = 30.sp,
        color = if (f.bien) Acierto else Error,
        modifier = modifier
            .clearAndSetSemantics {}
            .graphicsLayer {
                alpha = 1f - avance.value
                translationY = if (reducir) 0f else -48 * density * avance.value
            },
    )
}

/** Anillo de tiempo con los segundos restantes; pulsa en rojo por debajo de 10 s. */
@Composable
fun TimeRing(restanteMs: Long, totalMs: Long, size: Dp = 128.dp) {
    val segundos = ((restanteMs + 999) / 1000).toInt()
    val urgente = restanteMs < 10_000
    val reducir = LocalReduceMotion.current
    val pulso = if (urgente && restanteMs > 0 && !reducir) {
        rememberInfiniteTransition(label = "pulso").animateFloat(1f, 0.55f, infiniteRepeatable(tween(500), RepeatMode.Reverse), label = "alfa").value
    } else 1f
    val frac by animateFloatAsState((restanteMs.toFloat() / totalMs).coerceIn(0f, 1f), tween(100), label = "anillo")
    Box(
        Modifier.size(size).graphicsLayer { alpha = pulso }.semantics { contentDescription = "Quedan $segundos segundos" },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val grosor = this.size.minDimension * 0.08f
            val arco = Size(this.size.width - grosor, this.size.height - grosor)
            val origen = Offset(grosor / 2, grosor / 2)
            drawArc(Noche3, 0f, 360f, false, origen, arco, style = Stroke(grosor))
            drawArc(if (urgente) Error else Oro, -90f, 360f * frac, false, origen, arco, style = Stroke(grosor, cap = StrokeCap.Round))
        }
        Text("$segundos", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.34f).sp, color = if (urgente) Error else OroClaro)
    }
}

/** Nombre y carta (miniatura) de la pregunta: su categoría. */
@Composable
private fun InsigniaCarta(q: Question) {
    val carta = CardId.fromNombre(q.carta) ?: return
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        TarotCard(carta, Modifier.width(30.dp))
        Text(carta.nombre, fontFamily = Cinzel, color = OroClaro, fontSize = 14.sp, modifier = Modifier.padding(start = 8.dp))
        Text(" · ${carta.categoria}", color = Niebla, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ---------------------------------------------------------------- espera y resultados

@Composable
private fun Espera(vm: QuickViewModel, s: QuickUiState) {
    val room = s.room ?: return
    val r = s.result?.takeIf { it.round == room.round }
    Pantalla {
        Column(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }, horizontalAlignment = Alignment.CenterHorizontally) {
            when {
                r != null -> {
                    Titulo("¡Se acabó tu tiempo!")
                    Text("${plural(r.correctas, "acierto", "aciertos")} · ${plural(r.falladas, "fallo", "fallos")}", fontSize = 18.sp, modifier = Modifier.padding(top = 8.dp))
                }
                s.reentrada && s.participo -> {
                    Titulo("Volviste a la sala")
                    Nota("Tu partida quedó terminada con lo último que se guardó.", center = true)
                }
                s.isHost -> Titulo("Partida en juego")
                else -> {
                    Titulo("La partida ya empezó")
                    Nota("Espera a la revancha: entrarás automáticamente cuando el anfitrión la pida.", center = true)
                }
            }
        }
        if (s.escucharJugadores) {
            val quedan = stillPlaying(room, s.players)
            Text(
                if (quedan > 0) "${plural(quedan, "jugador sigue", "jugadores siguen")} jugando…" else "Calculando resultados…",
                color = Niebla,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            OrnateFrame { BarrasEnVivo(s.ronda) }
        }
        ErrorBox(s.error)
        if (s.isHost) TriviaButton("Terminar ahora", vm::terminarAhora, variante = Variante.Violeta, loading = s.busy == "terminar", modifier = Modifier.align(Alignment.CenterHorizontally))
    }
}

@Composable
private fun Resultados(vm: QuickViewModel, s: QuickUiState, botonCerrar: @Composable () -> Unit, onInicio: () -> Unit) {
    val room = s.room ?: return
    val ganadores = quickWinners(s.ronda)
    Pantalla {
        Text("SALA ${room.code} · RONDA ${room.round}", style = MaterialTheme.typography.labelSmall, color = Niebla, letterSpacing = 3.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Titulo(
            when (ganadores.size) {
                0 -> "Partida terminada"
                1 -> "¡Gana ${ganadores[0].apodo}!"
                else -> "Empate: ${ganadores.joinToString(" y ") { it.apodo }}"
            },
        )
        OrnateFrame { Podio(s.ronda, s.uid) }
        s.result?.takeIf { it.round == room.round && it.historial.isNotEmpty() }?.let { ResumenPersonal(it) }
        ErrorBox(s.error)
        if (s.isHost) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
                TriviaButton("Revancha", vm::revancha, loading = s.busy == "revancha", large = true)
                botonCerrar()
            }
        } else {
            TriviaButton("Salir", onInicio, variante = Variante.Fantasma, modifier = Modifier.align(Alignment.CenterHorizontally))
            Nota("Si el anfitrión pide la revancha, volverás al lobby.", center = true, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ResumenPersonal(r: QuickResult) {
    var abierto by rememberSaveable { mutableStateOf(r.historial.size <= 6) }
    OrnateFrame {
        Text(
            (if (abierto) "▾ " else "▸ ") + "Tu partida: ${plural(r.correctas, "acierto", "aciertos")} y ${plural(r.falladas, "fallo", "fallos")}",
            fontFamily = Cinzel,
            color = OroClaro,
            modifier = Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = if (abierto) "Ocultar" else "Ver preguntas") { abierto = !abierto }.padding(vertical = 4.dp),
        )
        if (abierto) {
            r.historial.forEach { h ->
                Column(Modifier.padding(top = 10.dp).semantics(mergeDescendants = true) {}) {
                    Text((if (h.correcta) "✓ " else "✗ ") + h.question.pregunta, fontWeight = FontWeight.SemiBold)
                    if (!h.correcta) Text("Tu respuesta: ${h.question.opciones[h.opcion]}", color = Error, style = MaterialTheme.typography.bodySmall)
                    Text("Correcta: ${h.question.opciones[h.question.respuestaCorrecta]}", color = Acierto, style = MaterialTheme.typography.bodySmall)
                    Nota(h.question.explicacion)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- piezas

@Composable
private fun CodigoSala(code: String, large: Boolean = false) {
    val qr = remember(code) { qrBitmap(quickJoinUrl(code)).asImageBitmap() }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("CÓDIGO DE LA SALA", style = MaterialTheme.typography.labelSmall, color = Niebla, letterSpacing = 3.sp)
        Text(
            code,
            fontFamily = Cinzel,
            fontWeight = FontWeight.Bold,
            fontSize = if (large) 64.sp else 44.sp,
            letterSpacing = 10.sp,
            color = OroClaro,
            modifier = Modifier.semantics { contentDescription = "Código: ${code.toList().joinToString(" ")}" },
        )
        Image(
            qr,
            contentDescription = "Código QR para entrar a la sala $code",
            modifier = Modifier.padding(vertical = 10.dp).size(if (large) 240.dp else 170.dp).clip(RoundedCornerShape(12.dp)).border(2.dp, Oro.copy(alpha = 0.6f), RoundedCornerShape(12.dp)),
        )
    }
}

@Composable
private fun ListaJugadores(players: List<QuickPlayer>, meUid: String?, onRemove: ((String) -> Unit)?) {
    if (players.isEmpty()) {
        Nota("Esperando jugadores…", center = true, modifier = Modifier.fillMaxWidth())
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        players.forEach { p ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, if (p.uid == meUid) Oro else Oro.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                    .background(Noche2.copy(alpha = 0.6f))
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AvatarIcon(p.avatar, Modifier.width(32.dp), decorative = true)
                Text(
                    p.apodo + (if (p.esBot) " · bot" else "") + (if (p.uid == meUid) " (tú)" else ""),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(start = 10.dp),
                )
                if (onRemove != null && p.uid != meUid) {
                    TextButton(onClick = { onRemove(p.uid) }, modifier = Modifier.semantics { contentDescription = "Sacar a ${p.apodo}" }) { Text("✕", color = Niebla) }
                }
            }
        }
    }
}

private val Medallas = listOf(OroClaro, Color(0xFFD9D9E3), Color(0xFFD79A6A))

/** Podio (los empatados comparten puesto) y tabla con aciertos y fallos. */
@Composable
private fun Podio(players: List<QuickPlayer>, meUid: String?, large: Boolean = false) {
    val filas = rankQuick(players)
    val reducir = LocalReduceMotion.current
    if (filas.isEmpty()) {
        Nota("Nadie jugó esta ronda.", center = true, modifier = Modifier.fillMaxWidth())
        return
    }
    val podio = filas.take(3)
    val visual = listOfNotNull(podio.getOrNull(1), podio.getOrNull(0), podio.getOrNull(2))
    Row(Modifier.fillMaxWidth().semantics { contentDescription = "Podio" }, horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
        visual.forEachIndexed { i, f ->
            val sube = remember(f.player.uid) { Animatable(if (reducir) 1f else 0f) }
            LaunchedEffect(f.player.uid) { sube.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 160f)) }
            Column(
                Modifier.width(if (large) 150.dp else 100.dp).graphicsLayer { alpha = sube.value; translationY = (1 - sube.value) * 40 * density },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AvatarIcon(f.player.avatar, Modifier.width(if (f.posicion == 1) 60.dp else 46.dp), decorative = true)
                Text(f.player.apodo, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = if (large) 20.sp else 14.sp)
                Text(plural(f.player.correctas, "acierto", "aciertos"), color = Niebla, fontSize = if (large) 16.sp else 12.sp)
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(listOf(120.dp, 80.dp, 56.dp)[(f.posicion - 1).coerceIn(0, 2)])
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.dp, Oro.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                        .background(Noche2),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    Text("${f.posicion}", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 30.sp, color = Medallas.getOrElse(f.posicion - 1) { Niebla }, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
    }
    Spacer(Modifier.height(14.dp))
    Row(Modifier.fillMaxWidth()) {
        Text("#", color = Niebla, modifier = Modifier.width(28.dp))
        Text("Jugador", color = Niebla, modifier = Modifier.weight(1f))
        Text("Aciertos", color = Niebla, modifier = Modifier.width(72.dp), textAlign = TextAlign.End)
        Text("Fallos", color = Niebla, modifier = Modifier.width(56.dp), textAlign = TextAlign.End)
    }
    filas.forEach { f ->
        val yo = f.player.uid == meUid
        Row(
            Modifier.fillMaxWidth().padding(vertical = 6.dp).semantics(mergeDescendants = true) {
                contentDescription = "Puesto ${f.posicion}: ${f.player.apodo}, ${plural(f.player.correctas, "acierto", "aciertos")}, ${plural(f.player.falladas, "fallo", "fallos")}"
            },
        ) {
            Text("${f.posicion}", color = if (yo) OroClaro else Pergamino, modifier = Modifier.width(28.dp))
            Text(f.player.apodo + if (f.player.esBot) " · bot" else "", color = if (yo) OroClaro else Pergamino, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text("${f.player.correctas}", color = Acierto, modifier = Modifier.width(72.dp), textAlign = TextAlign.End)
            Text("${f.player.falladas}", color = Error, modifier = Modifier.width(56.dp), textAlign = TextAlign.End)
        }
    }
}

/** Barras en vivo de aciertos por jugador. */
@Composable
private fun BarrasEnVivo(players: List<QuickPlayer>, large: Boolean = false) {
    val filas = rankQuick(players)
    val max = maxOf(1, players.maxOfOrNull { it.correctas } ?: 0)
    Column(verticalArrangement = Arrangement.spacedBy(if (large) 14.dp else 8.dp), modifier = Modifier.semantics { contentDescription = "Aciertos en vivo" }) {
        filas.forEach { f ->
            val ancho by animateFloatAsState(f.player.correctas.toFloat() / max, spring(stiffness = 120f), label = "barra")
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.semantics(mergeDescendants = true) {}) {
                AvatarIcon(f.player.avatar, Modifier.width(if (large) 44.dp else 28.dp), decorative = true)
                Text(f.player.apodo, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = if (large) 20.sp else 14.sp, modifier = Modifier.width(if (large) 180.dp else 96.dp).padding(start = 8.dp))
                Box(Modifier.weight(1f).height(if (large) 28.dp else 18.dp).clip(RoundedCornerShape(50)).background(Noche3)) {
                    Box(
                        Modifier
                            .fillMaxWidth(ancho)
                            .height(if (large) 28.dp else 18.dp)
                            .clip(RoundedCornerShape(50))
                            .background(if (f.player.finished) VioletaClaro.copy(alpha = 0.7f) else Oro),
                    )
                }
                Text(
                    "${f.player.correctas}" + if (f.player.finished) " ✓" else "",
                    fontSize = if (large) 22.sp else 14.sp,
                    textAlign = TextAlign.End,
                    modifier = Modifier.width(52.dp),
                )
            }
        }
    }
}

/** Vista para proyectar (anfitrión en «Solo pantalla»): lobby con código y QR, barras en vivo y podio. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Proyeccion(s: QuickUiState, controles: @Composable () -> Unit) {
    val room = s.room ?: return
    Pantalla {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Partida Rápida", fontFamily = Cinzel, color = OroClaro, fontSize = 20.sp, modifier = Modifier.weight(1f))
            Text(room.code + if (room.round > 1) " · ronda ${room.round}" else "", fontFamily = Cinzel, color = Niebla, letterSpacing = 4.sp)
        }
        when {
            room.status == QuickStatus.lobby -> {
                CodigoSala(room.code, large = true)
                Text(plural(s.players.size, "jugador", "jugadores") + " en la sala", fontFamily = Cinzel, color = OroClaro, fontSize = 22.sp)
                ListaJugadores(s.players, null, null)
            }
            room.status == QuickStatus.playing && !s.vencida -> {
                val quedan = stillPlaying(room, s.players)
                val limite = room.startedAtMs?.let { it + room.config.hardTimeoutMs }
                Titulo("¡A jugar!", size = 36)
                Text(
                    (if (quedan > 0) "${plural(quedan, "sigue", "siguen")} jugando" else "Calculando resultados…") +
                        (limite?.let { " · límite ${formatDuration(maxOf(0, it - s.now))}" } ?: ""),
                    color = Niebla,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                BarrasEnVivo(s.ronda, large = true)
            }
            else -> {
                val ganadores = quickWinners(s.ronda)
                Titulo(if (ganadores.size == 1) "¡Gana ${ganadores[0].apodo}!" else if (ganadores.size > 1) "¡Empate en la cima!" else "Partida terminada", size = 34)
                Podio(s.ronda, null, large = true)
            }
        }
        ErrorBox(s.error)
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            controles()
        }
    }
}
