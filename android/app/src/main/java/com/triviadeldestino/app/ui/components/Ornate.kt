package com.triviadeldestino.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.Noche2
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import com.triviadeldestino.app.ui.theme.OroOscuro
import com.triviadeldestino.app.ui.theme.Pergamino
import com.triviadeldestino.app.ui.theme.Violeta
import com.triviadeldestino.app.ui.theme.VioletaClaro

private val Forma = RoundedCornerShape(18.dp)

/** Esquinero dorado (se dibuja para arriba-izquierda y se refleja para las demás esquinas). */
@Composable
private fun Esquina(modifier: Modifier) {
    Canvas(modifier.size(22.dp)) {
        val w = 1.5f * density
        drawLine(Oro, Offset(2 * density, 13 * density), Offset(2 * density, 6 * density), w, StrokeCap.Round)
        drawLine(Oro, Offset(6 * density, 2 * density), Offset(13 * density, 2 * density), w, StrokeCap.Round)
        drawArc(Oro, 180f, 90f, false, topLeft = Offset(2 * density, 2 * density), size = androidx.compose.ui.geometry.Size(8 * density, 8 * density), style = androidx.compose.ui.graphics.drawscope.Stroke(w))
        drawCircle(OroClaro, 1.8f * density, Offset(6 * density, 6 * density))
    }
}

/** Panel con borde dorado tenue y esquineros, opcionalmente con título ornamental. */
@Composable
fun OrnateFrame(
    modifier: Modifier = Modifier,
    title: String? = null,
    borderColor: Color = Oro.copy(alpha = 0.25f),
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier
            .clip(Forma)
            .background(Noche2.copy(alpha = 0.88f))
            .border(BorderStroke(1.dp, borderColor), Forma),
    ) {
        Esquina(Modifier.padding(6.dp).align(Alignment.TopStart))
        Esquina(Modifier.padding(6.dp).align(Alignment.TopEnd).graphicsLayer { scaleX = -1f })
        Esquina(Modifier.padding(6.dp).align(Alignment.BottomStart).graphicsLayer { scaleY = -1f })
        Esquina(Modifier.padding(6.dp).align(Alignment.BottomEnd).graphicsLayer { scaleX = -1f; scaleY = -1f })
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            if (title != null) OrnateTitle(title)
            content()
        }
    }
}

/** Título centrado entre dos filetes dorados. */
@Composable
fun OrnateTitle(text: String, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, Oro.copy(alpha = 0.6f)))))
        Text(
            text,
            style = MaterialTheme.typography.titleMedium,
            color = OroClaro,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 12.dp).semantics { heading() },
        )
        Box(Modifier.weight(1f).height(1.dp).background(Brush.horizontalGradient(listOf(Oro.copy(alpha = 0.6f), Color.Transparent))))
    }
}

enum class Variante { Oro, Violeta, Fantasma, Peligro }

/** Botón con las variantes del tema (dorado principal, violeta, fantasma y peligro). Mínimo 48 dp de alto. */
@Composable
fun TriviaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variante: Variante = Variante.Oro,
    enabled: Boolean = true,
    loading: Boolean = false,
    large: Boolean = false,
) {
    val alto = if (large) 56.dp else 48.dp
    val relleno = PaddingValues(horizontal = if (large) 28.dp else 20.dp)
    val contenido: @Composable () -> Unit = {
        if (loading) {
            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            Spacer(Modifier.width(10.dp))
        }
        Text(text.uppercase(), style = MaterialTheme.typography.labelLarge)
    }
    when (variante) {
        Variante.Oro -> Button(
            onClick = onClick,
            enabled = enabled && !loading,
            shape = RoundedCornerShape(14.dp),
            contentPadding = PaddingValues(0.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, contentColor = Noche, disabledContainerColor = Color.Transparent, disabledContentColor = Noche.copy(alpha = 0.6f)),
            modifier = modifier.defaultMinSize(minHeight = alto),
        ) {
            Row(
                Modifier
                    .graphicsLayer { alpha = if (enabled) 1f else 0.5f }
                    .background(Brush.verticalGradient(listOf(OroClaro, Oro, OroOscuro)))
                    .defaultMinSize(minHeight = alto)
                    .padding(relleno),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) { contenido() }
        }
        Variante.Violeta -> Button(
            onClick = onClick,
            enabled = enabled && !loading,
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, VioletaClaro.copy(alpha = 0.7f)),
            colors = ButtonDefaults.buttonColors(containerColor = Violeta, contentColor = Pergamino),
            contentPadding = relleno,
            modifier = modifier.defaultMinSize(minHeight = alto),
        ) { contenido() }
        Variante.Fantasma, Variante.Peligro -> OutlinedButton(
            onClick = onClick,
            enabled = enabled && !loading,
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, if (variante == Variante.Peligro) Error.copy(alpha = 0.6f) else Oro.copy(alpha = 0.4f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = if (variante == Variante.Peligro) Error else OroClaro),
            contentPadding = relleno,
            modifier = modifier.defaultMinSize(minHeight = alto),
        ) { contenido() }
    }
}
