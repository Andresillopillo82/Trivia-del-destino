package com.triviadeldestino.app.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.triviadeldestino.app.data.friendlyMessage
import com.triviadeldestino.app.game.APODO_MAX
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.StandingRow
import com.triviadeldestino.app.game.awardTitles
import com.triviadeldestino.app.game.validateApodo
import com.triviadeldestino.app.nativo.AjustesSonidoYAvisos
import com.triviadeldestino.app.nativo.Efecto
import com.triviadeldestino.app.nativo.LocalEfectos
import androidx.compose.ui.platform.LocalView
import com.triviadeldestino.app.ui.GameUiState
import com.triviadeldestino.app.ui.GameViewModel
import com.triviadeldestino.app.ui.cards.AvatarIcon
import com.triviadeldestino.app.ui.cards.DestinyCard
import com.triviadeldestino.app.ui.components.AvatarPicker
import com.triviadeldestino.app.ui.components.ErrorBox
import com.triviadeldestino.app.ui.components.GroupCodeCard
import com.triviadeldestino.app.ui.components.LeaderboardRow
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.OrnateFrame
import com.triviadeldestino.app.ui.components.SuccessBox
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.components.TriviaTextField
import com.triviadeldestino.app.ui.components.Variante
import com.triviadeldestino.app.ui.components.plural
import com.triviadeldestino.app.ui.theme.LocalReduceMotion
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche2
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import com.triviadeldestino.app.ui.theme.Pergamino
import com.triviadeldestino.app.ui.theme.VioletaClaro
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

// ======================= Clasificación =======================

@Composable
fun LeaderboardScreen(s: GameUiState) {
    val c = GameConfig.DEFAULT
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Clasificación", style = MaterialTheme.typography.headlineLarge, color = OroClaro, modifier = Modifier.semantics { heading() })
                Text("${s.group?.nombre} · ${when { s.seasonOver -> "resultado final"; !s.online -> "últimos datos guardados"; else -> "en vivo" }}", color = Niebla)
            }
        }
        if (s.standings.isEmpty()) item { Nota("Todavía no hay jugadores en el grupo.", Modifier.fillMaxWidth(), center = true) }
        // animateItem: las filas se deslizan cuando cambian las posiciones.
        items(s.standings, key = { it.uid }) { r -> LeaderboardRow(r, r.uid == s.uid, detailed = true, modifier = Modifier.animateItem()) }
        item {
            OrnateFrame(Modifier.padding(top = 8.dp), title = "Cómo se puntúa") {
                listOf(
                    "${c.preguntasPorDia} cartas al día: +${c.puntosCorrecta} por cada acierto",
                    "+${c.bonoRapidez} extra si respondes en menos de ${c.umbralRapidezMs / 1000} s",
                    "Un comodín al día para cambiar la carta antes de ver la pregunta",
                    "Con ${c.aciertosParaRetar} aciertos en el día desbloqueas un reto (lanzarlo no da puntos)",
                    "+${c.puntosReto} para quien gana el reto (el retado si acierta, el retador si falla)",
                    "−${c.penalizacionReto} por cada pregunta de reto fallada, sin excepción",
                    "Si te retan puedes devolverlo: ${c.porcentajeDevolucion} % de éxito (responde el retador, sin premio); si falla, respondes dos preguntas",
                ).forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 2.dp)) }
                Nota("Desempate: más aciertos y, después, menor tiempo promedio. Al cerrar la semana, el primero recibe el título de Dueño del Destino.", Modifier.padding(top = 8.dp))
            }
        }
    }
}

// ======================= Perfil =======================

@Composable
fun ProfileScreen(vm: GameViewModel, s: GameUiState) {
    val perfil = s.profile ?: return
    val group = s.group ?: return
    val scope = rememberCoroutineScope()
    var apodo by rememberSaveable(perfil.apodo) { mutableStateOf(perfil.apodo) }
    var avatar by rememberSaveable(perfil.avatar) { mutableStateOf(perfil.avatar) }
    var guardando by remember { mutableStateOf(false) }
    var mensaje by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmarSalida by remember { mutableStateOf(false) }
    var saliendo by remember { mutableStateOf(false) }
    var clave by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(group.code, s.isCreator) { if (s.isCreator) clave = vm.claveAdmin() }
    val cambios = apodo.trim() != perfil.apodo || avatar != perfil.avatar

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Tu perfil", style = MaterialTheme.typography.headlineLarge, color = OroClaro, modifier = Modifier.fillMaxWidth().semantics { heading() }, textAlign = TextAlign.Center)
        OrnateFrame(title = "Apodo y símbolo") {
            TriviaTextField(apodo, { apodo = it }, "Apodo", maxLength = APODO_MAX, error = validateApodo(apodo).takeIf { apodo.isNotBlank() && it != null })
            Spacer(Modifier.height(12.dp))
            AvatarPicker(avatar) { avatar = it }
            Spacer(Modifier.height(12.dp))
            ErrorBox(error)
            SuccessBox(mensaje)
            Spacer(Modifier.height(8.dp))
            TriviaButton(
                "Guardar cambios",
                {
                    guardando = true
                    error = null
                    mensaje = null
                    scope.launch {
                        vm.guardarPerfil(apodo, avatar).onSuccess { mensaje = "¡Guardado!" }.onFailure { error = it.friendlyMessage() }
                        guardando = false
                    }
                },
                enabled = cambios && s.online,
                loading = guardando,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        OrnateFrame(title = group.nombre) {
            GroupCodeCard(group.code, group.nombre)
            if (s.isCreator) {
                Spacer(Modifier.height(16.dp))
                AdminKeyBox(clave, group.code)
            }
            Spacer(Modifier.height(16.dp))
            TriviaButton("Salir del grupo", { confirmarSalida = true }, variante = Variante.Peligro, enabled = s.online, modifier = Modifier.fillMaxWidth())
        }
        AjustesSonidoYAvisos()
    }

    if (confirmarSalida) {
        AlertDialog(
            onDismissRequest = { confirmarSalida = false },
            title = { Text("¿Salir del grupo?", color = OroClaro) },
            text = {
                Text(
                    "Dejarás de aparecer en la clasificación de «${group.nombre}». Podrás volver con el código ${group.code}, pero empezarás sin puntos." +
                        if (s.isCreator) " Seguirás siendo su creador." else "",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    saliendo = true
                    scope.launch {
                        vm.salir().onFailure { error = it.friendlyMessage() }
                        saliendo = false
                        confirmarSalida = false
                    }
                }, enabled = !saliendo) { Text("Salir", color = com.triviadeldestino.app.ui.theme.Error) }
            },
            dismissButton = { TextButton(onClick = { confirmarSalida = false }) { Text("Cancelar", color = OroClaro) } },
            containerColor = Noche2,
        )
    }
}

// ======================= Ceremonia =======================

private class Papel(val x: Float, val vx: Float, val vy: Float, val giro: Float, val color: Color, val w: Float, val h: Float)

/** Lluvia de confeti dorado y violeta (no se muestra con "Quitar animaciones"). */
@Composable
private fun Confeti() {
    if (LocalReduceMotion.current) return
    val papeles = remember {
        val rnd = Random(3)
        val colores = listOf(Oro, OroClaro, Color(0xFFFFF6D6), VioletaClaro, Color(0xFFC4B5FD))
        List(140) { Papel(rnd.nextFloat(), (rnd.nextFloat() - 0.5f) * 0.3f, 0.35f + rnd.nextFloat() * 0.5f, rnd.nextFloat() * 720f, colores.random(rnd), 6f + rnd.nextFloat() * 6f, 3f + rnd.nextFloat() * 4f) }
    }
    val t = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay(900)
        t.animateTo(1f, tween(4_500, easing = LinearEasing))
    }
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics { }) {
        if (t.value == 0f || t.value == 1f) return@Canvas
        papeles.forEachIndexed { i, p ->
            val avance = (t.value * 1.4f - (i % 7) * 0.05f).coerceIn(0f, 1f)
            if (avance <= 0f) return@forEachIndexed
            val x = (p.x + p.vx * avance) * size.width
            val y = -20f + avance * p.vy * 2.2f * size.height
            rotate(p.giro * avance, Offset(x, y)) {
                drawRect(p.color.copy(alpha = 1f - avance * 0.6f), Offset(x, y), Size(p.w * density, p.h * density))
            }
        }
    }
}

@Composable
fun CeremonyScreen(s: GameUiState, onClasificacion: () -> Unit) {
    val titulos = awardTitles(s.standings)
    val campeon = titulos.duenoDelDestino
    val reducir = LocalReduceMotion.current
    val entrada = remember { Animatable(if (reducir) 1f else 0f) }
    LaunchedEffect(Unit) { if (!reducir) entrada.animateTo(1f, tween(1_400)) }
    val efectos = LocalEfectos.current
    val vista = LocalView.current
    LaunchedEffect(campeon?.uid) {
        delay(700)
        efectos?.reproducir(Efecto.Fanfarria, vista)
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("${s.group?.nombre?.uppercase()} · FIN DE LA TEMPORADA", style = MaterialTheme.typography.labelSmall, color = Niebla, textAlign = TextAlign.Center)
            if (campeon != null) {
                DestinyCard(
                    campeon.apodo,
                    Modifier.width(220.dp).graphicsLayer {
                        val v = entrada.value
                        rotationY = (1 - v) * 180f
                        scaleX = 0.4f + 0.6f * v
                        scaleY = 0.4f + 0.6f * v
                        alpha = v
                        cameraDistance = 14f * density
                    },
                )
                Text(campeon.apodo, style = MaterialTheme.typography.displayMedium, color = OroClaro, textAlign = TextAlign.Center, modifier = Modifier.semantics { heading() })
                Text("es el Dueño del Destino con ${campeon.puntos} puntos", color = Pergamino, textAlign = TextAlign.Center)
            } else {
                Text("La temporada terminó sin puntos", style = MaterialTheme.typography.headlineMedium, color = OroClaro)
            }
            Titulo("El Vidente", "más aciertos seguidos", titulos.vidente) { plural(it.mejorRacha, "acierto") }
            Titulo("El Retador", "más retos ganados", titulos.retador) { plural(it.retosGanados, "reto") }
            s.standings.take(3).forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${r.posicion}.º", color = OroClaro)
                    AvatarIcon(r.avatar, Modifier.padding(horizontal = 8.dp).width(28.dp), decorative = true)
                    Text("${r.apodo} · ${r.puntos} pts")
                }
            }
            TriviaButton("Ver la clasificación final", onClasificacion, variante = Variante.Fantasma)
        }
        Confeti()
    }
}

@Composable
private fun Titulo(nombre: String, detalle: String, fila: StandingRow?, valor: (StandingRow) -> String) {
    OrnateFrame(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (fila != null) AvatarIcon(fila.avatar, Modifier.width(48.dp), decorative = true)
            Column(Modifier.padding(start = 12.dp)) {
                Text(nombre, style = MaterialTheme.typography.titleLarge, color = OroClaro)
                Text(fila?.apodo ?: "Sin ganador")
                Nota(if (fila != null) "${valor(fila)} · $detalle" else detalle)
            }
        }
    }
}
