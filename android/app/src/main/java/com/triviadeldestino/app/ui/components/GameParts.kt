package com.triviadeldestino.app.ui.components

import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.Question
import com.triviadeldestino.app.game.StandingRow
import com.triviadeldestino.app.ui.cards.AvatarIcon
import com.triviadeldestino.app.ui.theme.Acierto
import com.triviadeldestino.app.ui.theme.Cinzel
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.Noche2
import com.triviadeldestino.app.ui.theme.Noche3
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import com.triviadeldestino.app.ui.theme.OroOscuro
import com.triviadeldestino.app.ui.theme.Pergamino
import com.triviadeldestino.app.ui.theme.Violeta
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.ceil

const val WEB_URL = "https://trivia-59073.web.app"

fun joinUrl(code: String) = "$WEB_URL/unirse/$code"

fun formatSeconds(ms: Double?): String = if (ms == null) "—" else String.format(Locale.forLanguageTag("es"), "%.1f s", ms / 1000)

fun plural(n: Int, singular: String, plural: String = singular + "s") = "$n ${if (n == 1) singular else plural}"

fun formatDuration(ms: Long): String {
    val s = maxOf(0L, ms / 1000)
    val h = s / 3600
    val m = (s % 3600) / 60
    return when {
        h > 0 -> "$h h $m min"
        m > 0 -> "$m min"
        else -> "$s s"
    }
}

/** Selector de avatar: grupo de opciones accesible (TalkBack dice "Luna, seleccionado"). */
@Composable
fun AvatarPicker(value: AvatarId, onChange: (AvatarId) -> Unit) {
    FlowRow(
        Modifier.fillMaxWidth().selectableGroup(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        maxItemsInEachRow = 5,
    ) {
        AvatarId.entries.forEach { a ->
            val activo = a == value
            Column(
                Modifier
                    .width(62.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, if (activo) Oro else Oro.copy(alpha = 0f), RoundedCornerShape(12.dp))
                    .background(if (activo) Violeta.copy(alpha = 0.45f) else Noche.copy(alpha = 0f))
                    .selectable(selected = activo, role = Role.RadioButton, onClick = { onChange(a) })
                    .padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AvatarIcon(a, Modifier.size(44.dp), decorative = true)
                Text(a.nombre, style = MaterialTheme.typography.labelSmall, color = if (activo) OroClaro else Niebla)
            }
        }
    }
}

private val Medallas = listOf(OroClaro, androidx.compose.ui.graphics.Color(0xFFD9D9E3), androidx.compose.ui.graphics.Color(0xFFD79A6A))

/** Clasificación (los cambios de posición se animan con animateItem en las listas perezosas). */
@Composable
fun LeaderboardRow(r: StandingRow, yo: Boolean, detailed: Boolean, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, if (yo) Oro.copy(alpha = 0.7f) else Oro.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
            .background(if (yo) Violeta.copy(alpha = 0.35f) else Noche2.copy(alpha = 0.7f))
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = "Puesto ${r.posicion}: ${r.apodo}${if (yo) " (tú)" else ""}, ${r.puntos} puntos"
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "${r.posicion}",
            fontFamily = Cinzel,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            color = Medallas.getOrElse(r.posicion - 1) { Niebla },
            textAlign = TextAlign.Center,
            modifier = Modifier.width(28.dp),
        )
        AvatarIcon(r.avatar, Modifier.padding(horizontal = 8.dp).size(36.dp), decorative = true)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(r.apodo, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (yo) Etiqueta("Tú", OroClaro, Oro.copy(alpha = 0.2f))
                if (r.esBot) Etiqueta("bot", Niebla, Noche3)
            }
            if (detailed) {
                Text(
                    "${plural(r.aciertos, "acierto")} · racha ${r.rachaActual} (mejor ${r.mejorRacha}) · ${formatSeconds(r.tiempoPromedioMs)} prom." +
                        if (r.retosLanzados + r.retosGanados > 0) " · ${plural(r.retosGanados, "reto ganado", "retos ganados")}" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = Niebla,
                )
            }
        }
        Text("${r.puntos}", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 19.sp, color = OroClaro)
        Text(" pts", style = MaterialTheme.typography.labelSmall, color = Niebla)
    }
}

@Composable
private fun Etiqueta(texto: String, color: androidx.compose.ui.graphics.Color, fondo: androidx.compose.ui.graphics.Color) {
    Text(
        texto,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier.padding(start = 6.dp).clip(RoundedCornerShape(4.dp)).background(fondo).padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

/** Barra de tiempo que se vacía; roja en los últimos 5 segundos, con aviso del bonus. */
@Composable
fun TimerBar(remainingMs: Long, config: GameConfig = GameConfig.DEFAULT) {
    val segundos = ceil(remainingMs / 1000.0).toInt()
    val pct by animateFloatAsState((remainingMs.toFloat() / config.tiempoPreguntaMs).coerceIn(0f, 1f), label = "tiempo")
    val urgente = remainingMs <= 5_000
    val transcurrido = config.tiempoPreguntaMs - remainingMs
    val rapido = transcurrido < config.umbralRapidezMs
    Column(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "Quedan $segundos segundos" }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (rapido) "Bonus de rapidez: ${ceil((config.umbralRapidezMs - transcurrido) / 1000.0).toInt()} s" else "Sin bonus",
                style = MaterialTheme.typography.bodySmall,
                color = if (rapido) OroClaro else Niebla,
                modifier = Modifier.weight(1f),
            )
            Text("$segundos", fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, color = if (urgente) Error else OroClaro)
        }
        Spacer(Modifier.height(4.dp))
        Box(Modifier.fillMaxWidth().height(10.dp).clip(CircleShape).background(Noche3)) {
            Box(
                Modifier
                    .fillMaxWidth(pct)
                    .height(10.dp)
                    .clip(CircleShape)
                    .background(if (urgente) androidx.compose.ui.graphics.SolidColor(Error) else androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(OroOscuro, Oro, OroClaro))),
            )
        }
    }
}

private val Letras = listOf("A", "B", "C", "D")

/**
 * Círculo de la letra de una opción: cuadrado de al menos 32 dp que crece con la letra
 * (con texto al 200 % la letra no se sale del círculo).
 */
fun Modifier.circuloLetra(): Modifier = layout { medible, restricciones ->
    val p = medible.measure(restricciones.copy(minWidth = 0, minHeight = 0))
    val lado = maxOf(p.width, p.height, 32.dp.roundToPx())
    layout(lado, lado) { p.place((lado - p.width) / 2, (lado - p.height) / 2) }
}

/** Pregunta con 4 opciones; con `reveal` marca la correcta y la elegida. */
@Composable
fun QuestionView(
    question: Question,
    remainingMs: Long,
    selected: Int?,
    reveal: Boolean,
    enabled: Boolean,
    onSelect: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (!reveal) TimerBar(remainingMs)
        Text(question.pregunta, style = MaterialTheme.typography.titleLarge.copy(fontFamily = com.triviadeldestino.app.ui.theme.Inter, fontWeight = FontWeight.SemiBold), color = Pergamino)
        question.opciones.forEachIndexed { i, op ->
            val correcta = i == question.respuestaCorrecta
            val elegida = i == selected
            val (borde, fondo, texto) = when {
                reveal && correcta -> Triple(Acierto, Acierto.copy(alpha = 0.15f), Acierto)
                reveal && elegida -> Triple(Error, Error.copy(alpha = 0.15f), Error)
                elegida -> Triple(Oro, Violeta.copy(alpha = 0.4f), Pergamino)
                reveal || !enabled -> Triple(Oro.copy(alpha = 0.15f), Noche2.copy(alpha = 0.6f), Niebla)
                else -> Triple(Oro.copy(alpha = 0.3f), Noche2.copy(alpha = 0.8f), Pergamino)
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, borde, RoundedCornerShape(14.dp))
                    .background(fondo)
                    .selectable(selected = elegida, enabled = enabled && !reveal, role = Role.Button, onClick = { onSelect(i) })
                    .semantics {
                        if (reveal) stateDescription = if (correcta) "Respuesta correcta" else if (elegida) "Tu respuesta, incorrecta" else ""
                    }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.border(1.dp, Oro.copy(alpha = 0.5f), CircleShape).circuloLetra().padding(4.dp), contentAlignment = Alignment.Center) {
                    Text(Letras[i], fontFamily = Cinzel, color = OroClaro, fontSize = 14.sp)
                }
                Text(op, color = texto, modifier = Modifier.weight(1f).padding(start = 12.dp))
                if (reveal && correcta) Text("Correcta", color = Acierto, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
                if (reveal && elegida && !correcta) Text("Tu respuesta", color = Error, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** QR de un texto como imagen (ZXing). */
fun qrBitmap(texto: String, size: Int = 512): Bitmap {
    val matriz = QRCodeWriter().encode(texto, BarcodeFormat.QR_CODE, size, size, mapOf(EncodeHintType.MARGIN to 1))
    val oro = 0xFFF1D77A.toInt()
    val noche = 0xFF0B0A10.toInt()
    val pixeles = IntArray(size * size) { i -> if (matriz[i % size, i / size]) noche else oro }
    return Bitmap.createBitmap(pixeles, size, size, Bitmap.Config.ARGB_8888)
}

/** Código del grupo con QR y botones para compartir o copiar el enlace. */
@Composable
fun GroupCodeCard(code: String, nombre: String, mostrarQr: Boolean = true) {
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    var copiado by remember { mutableStateOf(false) }
    val qr = remember(code) { qrBitmap(joinUrl(code)).asImageBitmap() }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("CÓDIGO DEL GRUPO", style = MaterialTheme.typography.labelSmall, color = Niebla, letterSpacing = 3.sp)
        Text(
            code,
            fontFamily = Cinzel,
            fontWeight = FontWeight.Bold,
            fontSize = 44.sp,
            letterSpacing = 10.sp,
            color = OroClaro,
            modifier = Modifier.semantics { contentDescription = "Código: ${code.toList().joinToString(" ")}" },
        )
        if (mostrarQr) {
            Image(
                qr,
                contentDescription = "Código QR para unirse a $nombre",
                modifier = Modifier.padding(vertical = 10.dp).size(170.dp).clip(RoundedCornerShape(12.dp)).border(2.dp, Oro.copy(alpha = 0.6f), RoundedCornerShape(12.dp)),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TriviaButton("Compartir", {
                val envio = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "Únete a «$nombre» en la Trivia del Destino con el código $code: ${joinUrl(code)}")
                }
                context.startActivity(Intent.createChooser(envio, "Invitar al grupo"))
            }, variante = Variante.Fantasma)
            TriviaButton(if (copiado) "¡Copiado!" else "Copiar enlace", {
                scope.launch {
                    clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("Enlace", joinUrl(code))))
                    copiado = true
                }
            }, variante = Variante.Fantasma)
        }
    }
}
