package com.triviadeldestino.app.nativo

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.staticCompositionLocalOf
import com.triviadeldestino.app.R
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Preferencias del jugador en este dispositivo (SharedPreferences). */
class Preferencias(context: Context) {
    private val prefs = context.getSharedPreferences("preferencias", Context.MODE_PRIVATE)

    private val _sonido = MutableStateFlow(prefs.getBoolean("sonido", true))
    private val _vibracion = MutableStateFlow(prefs.getBoolean("vibracion", true))
    private val _recordatorio = MutableStateFlow(prefs.getBoolean("recordatorio", false))
    val sonido: StateFlow<Boolean> = _sonido.asStateFlow()
    val vibracion: StateFlow<Boolean> = _vibracion.asStateFlow()
    val recordatorio: StateFlow<Boolean> = _recordatorio.asStateFlow()

    fun setSonido(v: Boolean) = guardar("sonido", v, _sonido)
    fun setVibracion(v: Boolean) = guardar("vibracion", v, _vibracion)
    fun setRecordatorio(v: Boolean) = guardar("recordatorio", v, _recordatorio)

    private fun guardar(clave: String, v: Boolean, estado: MutableStateFlow<Boolean>) {
        prefs.edit().putBoolean(clave, v).apply()
        estado.value = v
    }
}

enum class Efecto { Carta, Acierto, Fallo, Tic, Fanfarria }

/**
 * Sonidos cortos (SoundPool, baja latencia) y vibración háptica del sistema
 * (performHapticFeedback: respeta los ajustes del teléfono y no necesita el permiso VIBRATE).
 */
class Efectos(context: Context, private val prefs: Preferencias) {
    private val pool = SoundPool.Builder()
        .setMaxStreams(3)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .build()

    private val ids = mapOf(
        Efecto.Carta to pool.load(context, R.raw.sonido_carta, 1),
        Efecto.Acierto to pool.load(context, R.raw.sonido_acierto, 1),
        Efecto.Fallo to pool.load(context, R.raw.sonido_fallo, 1),
        Efecto.Tic to pool.load(context, R.raw.sonido_tic, 1),
        Efecto.Fanfarria to pool.load(context, R.raw.sonido_fanfarria, 1),
    )

    /** Último efecto reproducido (lo usan las pruebas para comprobar que suenan). */
    @Volatile
    var ultimo: Efecto? = null
        private set

    fun reproducir(efecto: Efecto, vista: View? = null) {
        ultimo = efecto
        if (prefs.sonido.value) ids[efecto]?.let { pool.play(it, 1f, 1f, 1, 0, 1f) }
        if (prefs.vibracion.value && vista != null) vista.performHapticFeedback(haptica(efecto))
    }

    private fun haptica(e: Efecto): Int = when (e) {
        Efecto.Acierto, Efecto.Fanfarria -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
        Efecto.Fallo -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
        Efecto.Carta -> HapticFeedbackConstants.CONTEXT_CLICK
        Efecto.Tic -> HapticFeedbackConstants.CLOCK_TICK
    }
}

/** Acceso a los efectos desde cualquier pantalla de Compose. */
val LocalEfectos = staticCompositionLocalOf<Efectos?> { null }
