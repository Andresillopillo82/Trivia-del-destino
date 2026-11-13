package com.triviadeldestino.app.nativo

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.triviadeldestino.app.TriviaApp
import com.triviadeldestino.app.ui.components.ErrorBox
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.OrnateFrame
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro

/** Interruptor accesible: toda la fila se activa (TalkBack lo anuncia como interruptor). */
@Composable
private fun Interruptor(titulo: String, detalle: String, valor: Boolean, onCambio: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .toggleable(value = valor, role = Role.Switch, onValueChange = onCambio)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(titulo)
            Nota(detalle)
        }
        Switch(checked = valor, onCheckedChange = null, colors = SwitchDefaults.colors(checkedTrackColor = Oro, checkedThumbColor = OroClaro))
    }
}

/** Sonido, vibración y recordatorio diario (preferencias de este dispositivo). */
@Composable
fun AjustesSonidoYAvisos() {
    val context = LocalContext.current
    val prefs = (context.applicationContext as TriviaApp).container.preferencias
    val sonido by prefs.sonido.collectAsStateWithLifecycle()
    val vibracion by prefs.vibracion.collectAsStateWithLifecycle()
    val recordatorio by prefs.recordatorio.collectAsStateWithLifecycle()
    var aviso by remember { mutableStateOf<String?>(null) }

    fun activarRecordatorio() {
        prefs.setRecordatorio(true)
        programarRecordatorio(context)
        aviso = null
    }

    // Android 13+: el permiso de notificaciones se pide solo cuando el jugador activa el recordatorio.
    val pedirPermiso = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { concedido ->
        if (concedido) activarRecordatorio() else aviso = "Sin permiso de notificaciones no podemos recordarte tu carta. Puedes activarlo en los ajustes del teléfono."
    }

    OrnateFrame(title = "Sonido y avisos") {
        Interruptor("Sonido", "Efectos al voltear la carta, acertar, fallar y en la ceremonia.", sonido, prefs::setSonido)
        Interruptor("Vibración", "Vibra al acertar, al fallar y en los últimos segundos.", vibracion, prefs::setVibracion)
        Interruptor("Recordatorio diario", "A las 19:00, solo si aún te quedan cartas por jugar ese día.", recordatorio) { activar ->
            when {
                !activar -> {
                    prefs.setRecordatorio(false)
                    cancelarRecordatorio(context)
                }
                puedeNotificar(context) -> activarRecordatorio()
                Build.VERSION.SDK_INT >= 33 -> pedirPermiso.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        ErrorBox(aviso)
    }
}
