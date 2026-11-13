package com.triviadeldestino.app.ui.theme

import android.provider.Settings
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext

private val Esquema = darkColorScheme(
    primary = Oro,
    onPrimary = Noche,
    secondary = Violeta,
    onSecondary = Pergamino,
    tertiary = VioletaClaro,
    background = Noche,
    onBackground = Pergamino,
    surface = Noche2,
    onSurface = Pergamino,
    surfaceVariant = Noche3,
    onSurfaceVariant = Niebla,
    error = Error,
    onError = Noche,
    outline = OroOscuro,
)

/**
 * true si el sistema pide no animar ("Quitar animaciones" en Accesibilidad o escala de animación 0).
 * Las animaciones decorativas se desactivan y los cambios son instantáneos.
 */
val LocalReduceMotion = staticCompositionLocalOf { false }

@Composable
fun TriviaTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val reducir = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    // La app es siempre oscura: es parte de la ambientación. El color de contenido por defecto
    // (texto sin color explícito) es pergamino: sin un Surface alrededor, Compose usaría negro.
    MaterialTheme(colorScheme = Esquema, typography = TriviaTypography) {
        CompositionLocalProvider(
            LocalReduceMotion provides reducir,
            LocalContentColor provides Pergamino,
            content = content,
        )
    }
}
