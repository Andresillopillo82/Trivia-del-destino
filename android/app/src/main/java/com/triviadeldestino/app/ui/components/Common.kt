package com.triviadeldestino.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.triviadeldestino.app.ui.cards.Deck
import com.triviadeldestino.app.ui.theme.Acierto
import com.triviadeldestino.app.ui.theme.Error
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.Noche3
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro

/** Campo de texto con etiqueta, ayuda y error (TalkBack los anuncia juntos). */
@Composable
fun TriviaTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    hint: String? = null,
    error: String? = null,
    placeholder: String? = null,
    maxLength: Int = 40,
    mayusculas: Boolean = false,
    textStyle: TextStyle = MaterialTheme.typography.bodyLarge,
    /** Acción del botón ✓ del teclado (enviar el formulario). */
    onDone: (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange((if (mayusculas) it.uppercase() else it).take(maxLength)) },
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it, color = Niebla.copy(alpha = 0.6f)) } },
        supportingText = (error ?: hint)?.let { { Text(it, color = if (error != null) Error else Niebla) } },
        isError = error != null,
        singleLine = true,
        textStyle = textStyle,
        keyboardOptions = KeyboardOptions(
            capitalization = if (mayusculas) KeyboardCapitalization.Characters else KeyboardCapitalization.Sentences,
            keyboardType = if (mayusculas) KeyboardType.Ascii else KeyboardType.Text,
            autoCorrectEnabled = !mayusculas,
            imeAction = if (onDone != null) ImeAction.Done else ImeAction.Default,
        ),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Oro,
            unfocusedBorderColor = Oro.copy(alpha = 0.35f),
            focusedLabelColor = OroClaro,
            unfocusedLabelColor = Niebla,
            cursorColor = OroClaro,
            focusedContainerColor = Noche3.copy(alpha = 0.8f),
            unfocusedContainerColor = Noche3.copy(alpha = 0.8f),
        ),
        modifier = modifier.fillMaxWidth(),
    )
}

/** Mensaje de error destacado (TalkBack lo anuncia al aparecer). */
@Composable
fun ErrorBox(mensaje: String?, modifier: Modifier = Modifier) {
    if (mensaje == null) return
    Text(
        mensaje,
        color = Error,
        style = MaterialTheme.typography.bodyMedium,
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, Error.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .background(Error.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
            .padding(12.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
    )
}

/** Mensaje de éxito. */
@Composable
fun SuccessBox(mensaje: String?, modifier: Modifier = Modifier) {
    if (mensaje == null) return
    Text(
        mensaje,
        color = Acierto,
        style = MaterialTheme.typography.bodyMedium,
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, Acierto.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .background(Acierto.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
            .padding(12.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
    )
}

/** Pantalla centrada para carga, errores y avisos. */
@Composable
fun StatusScreen(title: String, loading: Boolean = false, content: @Composable ColumnScope.() -> Unit = {}) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (loading) {
            Deck(shuffling = true, modifier = Modifier.width(96.dp))
            Spacer(Modifier.height(24.dp))
        }
        Text(
            title,
            style = MaterialTheme.typography.headlineMedium,
            color = OroClaro,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        Spacer(Modifier.height(16.dp))
        content()
    }
}

@Composable
fun LoadingScreen(texto: String = "Consultando a las estrellas…") = StatusScreen(texto, loading = true)

/** Aviso fijo cuando no hay internet. */
@Composable
fun OfflineBanner(online: Boolean) {
    if (online) return
    Text(
        "Sin conexión a internet. Ves los últimos datos guardados; para sacar tus cartas necesitas conexión.",
        color = Noche,
        style = MaterialTheme.typography.bodySmall,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .background(Error)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
    )
}

/** Texto secundario en gris. */
@Composable
fun Nota(texto: String, modifier: Modifier = Modifier, center: Boolean = false, color: Color = Niebla) {
    Text(
        texto,
        style = MaterialTheme.typography.bodySmall,
        color = color,
        textAlign = if (center) TextAlign.Center else TextAlign.Start,
        modifier = modifier,
    )
}

/** Título de pantalla en dorado. */
@Composable
fun ScreenTitle(texto: String, subtitulo: String? = null) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(texto, style = MaterialTheme.typography.headlineLarge, color = OroClaro, textAlign = TextAlign.Center)
        if (subtitulo != null) Text(subtitulo, color = Niebla, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyMedium)
    }
}


/**
 * Texto de una sola línea que se reduce lo justo para caber (útil en pestañas y cabeceras
 * cuando el usuario usa letra muy grande en Accesibilidad).
 */
@Composable
fun TextoAjustable(
    texto: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    minimo: androidx.compose.ui.unit.TextUnit = 10.sp,
) {
    androidx.compose.foundation.text.BasicText(
        texto,
        modifier = modifier,
        style = style.copy(color = color),
        maxLines = 1,
        autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = minimo, maxFontSize = style.fontSize),
    )
}
