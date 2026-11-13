package com.triviadeldestino.app.ui.cards

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import com.triviadeldestino.app.R
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.CardId
import com.triviadeldestino.app.ui.theme.Cinzel
import com.triviadeldestino.app.ui.theme.Inter
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro

/** Proporción de todas las cartas (lienzo de 200 × 340, igual que los SVG de la web). */
const val CARD_RATIO = 200f / 340f

@DrawableRes
fun CardId.drawable(): Int = when (this) {
    CardId.LOCO -> R.drawable.carta_loco
    CardId.MAGO -> R.drawable.carta_mago
    CardId.SACERDOTISA -> R.drawable.carta_sacerdotisa
    CardId.EMPERATRIZ -> R.drawable.carta_emperatriz
    CardId.EMPERADOR -> R.drawable.carta_emperador
    CardId.ENAMORADOS -> R.drawable.carta_enamorados
    CardId.CARRO -> R.drawable.carta_carro
    CardId.ERMITANO -> R.drawable.carta_ermitano
    CardId.RUEDA -> R.drawable.carta_rueda
    CardId.MUNDO -> R.drawable.carta_mundo
}

@DrawableRes
fun AvatarId.drawable(): Int = when (this) {
    AvatarId.SOL -> R.drawable.avatar_sol
    AvatarId.LUNA -> R.drawable.avatar_luna
    AvatarId.ESTRELLA -> R.drawable.avatar_estrella
    AvatarId.OJO -> R.drawable.avatar_ojo
    AvatarId.LLAVE -> R.drawable.avatar_llave
    AvatarId.COPA -> R.drawable.avatar_copa
    AvatarId.ESPADA -> R.drawable.avatar_espada
    AvatarId.PENTACULO -> R.drawable.avatar_pentaculo
    AvatarId.VELA -> R.drawable.avatar_vela
    AvatarId.ROSA -> R.drawable.avatar_rosa
}

/** Texto a dibujar sobre la ilustración, en coordenadas del lienzo de 200 × 340. */
private data class CardLabel(
    val text: String,
    val baseline: Float,
    val size: Float,
    val family: FontFamily,
    val weight: FontWeight,
    val color: Color,
    val maxWidth: Float,
    val letterSpacing: Float = 0f,
)

/**
 * Ilustración vectorial (convertida de los SVG de la web) con los textos encima.
 * Los textos se encogen si no caben, como el textLength de los SVG.
 */
@Composable
private fun CardBase(
    @DrawableRes art: Int,
    description: String,
    labels: List<CardLabel>,
    modifier: Modifier = Modifier,
) {
    val measurer = rememberTextMeasurer()
    Box(
        modifier
            .aspectRatio(CARD_RATIO)
            .semantics {
                contentDescription = description
                role = Role.Image
            },
    ) {
        Image(painterResource(art), contentDescription = null, modifier = Modifier.fillMaxSize())
        Canvas(Modifier.fillMaxSize()) {
            val escala = size.width / 200f
            labels.forEach { drawLabel(measurer, it, escala) }
        }
    }
}

private fun DrawScope.drawLabel(measurer: TextMeasurer, label: CardLabel, escala: Float) {
    fun medir(factor: Float) = measurer.measure(
        label.text,
        TextStyle(
            fontFamily = label.family,
            fontWeight = label.weight,
            color = label.color,
            fontSize = (label.size * escala * factor).toSp(),
            letterSpacing = (label.letterSpacing * escala * factor).toSp(),
        ),
    )
    var layout = medir(1f)
    val max = label.maxWidth * escala
    if (layout.size.width > max) layout = medir(max / layout.size.width)
    val x = 100f * escala - layout.size.width / 2f
    val y = label.baseline * escala - layout.firstBaseline
    drawText(layout, topLeft = Offset(x, y))
}

/** Cara de un arcano: numeral arriba, símbolo al centro, nombre y categoría abajo. */
@Composable
fun TarotCard(card: CardId, modifier: Modifier = Modifier) {
    CardBase(
        art = card.drawable(),
        description = "${card.nombre}: ${card.categoria}",
        labels = listOf(
            CardLabel(card.numeral, 58f, 20f, Cinzel, FontWeight.Bold, OroClaro, 60f, 2f),
            CardLabel(card.nombre.uppercase(), 281.5f, 13f, Cinzel, FontWeight.SemiBold, OroClaro, 150f, 1.5f),
            CardLabel(card.categoria.uppercase(), 310f, 8f, Inter, FontWeight.Normal, Oro.copy(alpha = 0.85f), 116f, 1f),
        ),
        modifier = modifier,
    )
}

/** Reverso del mazo. */
@Composable
fun CardBack(modifier: Modifier = Modifier) {
    CardBase(R.drawable.carta_reverso, "Carta boca abajo", emptyList(), modifier)
}

/** Carta de Reto: carmesí con espadas cruzadas. */
@Composable
fun ChallengeCard(de: String?, modifier: Modifier = Modifier) {
    CardBase(
        art = R.drawable.carta_reto,
        description = if (de != null) "Carta de Reto de $de" else "Carta de Reto",
        labels = listOf(
            CardLabel("RETO", 58f, 18f, Cinzel, FontWeight.Bold, OroClaro, 120f, 4f),
            CardLabel(if (de != null) "DE ${de.uppercase()}" else "CARTA DE RETO", 281.5f, 11f, Cinzel, FontWeight.SemiBold, OroClaro, 150f, 1f),
            CardLabel("PREGUNTA DIFÍCIL", 310f, 8.5f, Inter, FontWeight.Normal, Oro, 140f, 1f),
        ),
        modifier = modifier,
    )
}

/** Carta dorada del Dueño del Destino. */
@Composable
fun DestinyCard(nombre: String, modifier: Modifier = Modifier) {
    CardBase(
        art = R.drawable.carta_destino,
        description = "Dueño del Destino: $nombre",
        labels = listOf(
            CardLabel("DUEÑO DEL DESTINO", 56f, 11f, Cinzel, FontWeight.Bold, OroClaro, 128f),
            CardLabel(nombre.uppercase(), 281.5f, 14f, Cinzel, FontWeight.Bold, OroClaro, 150f, 1f),
            CardLabel("CAMPEÓN DE LA SEMANA", 310f, 8f, Inter, FontWeight.Normal, OroClaro, 140f, 1.5f),
        ),
        modifier = modifier,
    )
}

/** Avatar circular con el símbolo elegido. */
@Composable
fun AvatarIcon(avatar: AvatarId, modifier: Modifier = Modifier, decorative: Boolean = false) {
    Image(
        painter = painterResource(avatar.drawable()),
        contentDescription = if (decorative) null else "Avatar: ${avatar.nombre}",
        modifier = modifier.aspectRatio(1f),
    )
}
