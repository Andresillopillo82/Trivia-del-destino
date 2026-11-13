package com.triviadeldestino.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import com.triviadeldestino.app.ui.theme.LocalReduceMotion
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.Violeta
import kotlin.math.sin
import kotlin.random.Random

private class Estrella(val x: Float, val y: Float, val r: Float, val fase: Float, val vel: Float)
private class Mota(val x: Float, val y0: Float, val r: Float, val vel: Float, val fase: Float)

/**
 * Fondo de estrellas titilantes y polvo dorado que asciende (posiciones relativas, 0–1).
 * Con "Quitar animaciones" se dibuja estático.
 */
@Composable
fun Starfield(modifier: Modifier = Modifier) {
    val reducir = LocalReduceMotion.current
    val estrellas = remember {
        val rnd = Random(7)
        List(140) { Estrella(rnd.nextFloat(), rnd.nextFloat(), rnd.nextFloat() * 1.1f + 0.3f, rnd.nextFloat() * 6.28f, rnd.nextFloat() * 0.8f + 0.3f) }
    }
    val motas = remember {
        val rnd = Random(11)
        List(18) { Mota(rnd.nextFloat(), rnd.nextFloat(), rnd.nextFloat() * 1.4f + 0.6f, rnd.nextFloat() * 0.5f + 0.25f, rnd.nextFloat() * 6.28f) }
    }
    val tiempo = if (reducir) {
        null
    } else {
        rememberInfiniteTransition(label = "estrellas").animateFloat(
            initialValue = 0f,
            targetValue = 60f,
            animationSpec = infiniteRepeatable(tween(60_000, easing = LinearEasing), RepeatMode.Restart),
            label = "tiempo",
        )
    }

    Canvas(
        modifier
            .fillMaxSize()
            .background(Noche)
            .clearAndSetSemantics { },
    ) {
        // Resplandor violeta arriba
        drawRect(Brush.radialGradient(listOf(Violeta.copy(alpha = 0.35f), Color.Transparent), center = Offset(size.width / 2, 0f), radius = size.height * 0.6f))
        val s = tiempo?.value ?: 0f
        val d = density
        estrellas.forEach { e ->
            val a = if (tiempo == null) 0.6f else 0.35f + 0.65f * (0.5f + 0.5f * sin(s * e.vel * 2f + e.fase))
            drawCircle(Color(0xFFEDE6F6).copy(alpha = a * 0.8f), e.r * d, Offset(e.x * size.width, e.y * size.height))
        }
        motas.forEach { m ->
            val y = ((m.y0 - s * m.vel * 0.02f) % 1f + 1f) % 1f
            val x = m.x * size.width + sin(s + m.fase) * 6f * d
            val a = 0.25f + 0.35f * (0.5f + 0.5f * sin(s * 1.5f + m.fase * 3f))
            drawCircle(Oro.copy(alpha = a), m.r * d, Offset(x, y * size.height))
        }
        // Halo dorado tenue abajo
        drawCircle(
            Brush.radialGradient(listOf(Oro.copy(alpha = 0.06f), Color.Transparent), center = Offset(size.width / 2, size.height * 1.1f), radius = size.width),
            radius = size.width,
            center = Offset(size.width / 2, size.height * 1.1f),
        )
    }
}
