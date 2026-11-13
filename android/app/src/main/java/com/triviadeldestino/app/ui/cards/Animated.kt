package com.triviadeldestino.app.ui.cards

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.triviadeldestino.app.ui.theme.LocalReduceMotion

/**
 * Carta que se voltea en 3D del reverso al anverso al aparecer (o al pasar `revealed` a true).
 * Con "Quitar animaciones" se muestra directamente la cara.
 */
@Composable
fun FlipCard(
    revealed: Boolean,
    back: @Composable () -> Unit,
    front: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onFlipped: () -> Unit = {},
) {
    val reducir = LocalReduceMotion.current
    val giro = remember { Animatable(0f) }
    val densidad = LocalDensity.current.density

    LaunchedEffect(revealed) {
        val destino = if (revealed) 180f else 0f
        if (reducir) giro.snapTo(destino) else giro.animateTo(destino, tween(900, easing = CubicBezierEasing(0.65f, 0f, 0.35f, 1f)))
        if (revealed) onFlipped()
    }

    Box(
        modifier
            .aspectRatio(CARD_RATIO)
            .graphicsLayer {
                rotationY = giro.value
                cameraDistance = 14f * densidad
            },
    ) {
        if (giro.value <= 90f) {
            back()
        } else {
            // La cara se dibuja girada 180° para que no aparezca en espejo.
            Box(Modifier.fillMaxSize().graphicsLayer { rotationY = 180f }) { front() }
        }
    }
}

private const val CAPAS = 5

/** Mazo boca abajo; mientras `shuffling` es true, las cartas se abren en abanico y se cruzan. */
@Composable
fun Deck(shuffling: Boolean, modifier: Modifier = Modifier) {
    val reducir = LocalReduceMotion.current
    val transicion = rememberInfiniteTransition(label = "barajado")
    val fase = transicion.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(550, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "fase",
    )

    Box(modifier.aspectRatio(CARD_RATIO).clearAndSetSemantics { }) {
        repeat(CAPAS) { i ->
            val lado = if (i % 2 == 0) -1f else 1f
            Box(
                Modifier
                    .fillMaxSize()
                    .zIndex(i.toFloat())
                    .graphicsLayer {
                        val t = if (shuffling && !reducir) fase.value else 0f
                        val reposoX = -i * 1.5f * density
                        val reposoY = -i * 2f * density
                        translationX = reposoX + t * lado * (40f + i * 12f) * density
                        translationY = reposoY - t * (10f + i * 3f) * density
                        rotationZ = (i - 2) * 1.2f + t * lado * (10f + i * 2f)
                    }
                    .shadow(8.dp, clip = false),
            ) {
                CardBack(Modifier.fillMaxSize())
            }
        }
    }
}
