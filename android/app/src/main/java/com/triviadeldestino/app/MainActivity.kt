package com.triviadeldestino.app

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.triviadeldestino.app.game.groupCodeFrom
import com.triviadeldestino.app.game.quickCodeFrom
import com.triviadeldestino.app.ui.quick.QuickViewModel
import com.triviadeldestino.app.ui.quick.RutaRapida
import com.triviadeldestino.app.nativo.LocalEfectos
import com.triviadeldestino.app.ui.GameViewModel
import com.triviadeldestino.app.ui.TriviaRoot
import com.triviadeldestino.app.ui.components.Starfield
import com.triviadeldestino.app.ui.theme.TriviaTheme

class MainActivity : ComponentActivity() {
    private val vm: GameViewModel by viewModels { GameViewModel.Factory }
    private val quick: QuickViewModel by viewModels { QuickViewModel.Factory }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        // La app es siempre oscura: barras del sistema transparentes con íconos claros,
        // aunque el teléfono esté en tema claro.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) recibirEnlace(intent)
        val efectos = (application as TriviaApp).container.efectos
        setContent {
            TriviaTheme {
                CompositionLocalProvider(LocalEfectos provides efectos) {
                    Box(Modifier.fillMaxSize()) {
                        Starfield()
                        TriviaRoot(vm, quick)
                    }
                }
            }
        }
    }

    /** Con la app ya abierta (launchMode singleTop), un enlace nuevo llega aquí. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        recibirEnlace(intent)
    }

    /** Enlace de invitación (…/unirse/A7K2Q) o de una sala de Partida Rápida (…/rapida/ABCDE). */
    private fun recibirEnlace(intent: Intent?) {
        val datos = intent?.takeIf { it.action == Intent.ACTION_VIEW }?.dataString ?: return
        if (datos.contains("/rapida/") || datos.contains("/sala/")) {
            quickCodeFrom(datos)?.let { quick.ruta.value = RutaRapida.Sala(it) }
            return
        }
        groupCodeFrom(datos)?.let { vm.pendingJoin.value = it }
    }
}
