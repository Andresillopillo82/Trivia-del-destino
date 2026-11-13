package com.triviadeldestino.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.triviadeldestino.app.R
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.TipoReto
import com.triviadeldestino.app.game.tipoReto
import com.triviadeldestino.app.game.quickCodeFrom
import com.triviadeldestino.app.nativo.ScannerScreen
import com.triviadeldestino.app.ui.quick.QuickMenuScreen
import com.triviadeldestino.app.ui.quick.QuickRoomScreen
import com.triviadeldestino.app.ui.quick.QuickViewModel
import com.triviadeldestino.app.ui.quick.RutaRapida
import com.triviadeldestino.app.ui.components.ErrorBox
import com.triviadeldestino.app.ui.components.LoadingScreen
import com.triviadeldestino.app.ui.components.OfflineBanner
import com.triviadeldestino.app.ui.components.StatusScreen
import com.triviadeldestino.app.ui.components.TextoAjustable
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.screens.CeremonyScreen
import com.triviadeldestino.app.ui.screens.ChallengePlayScreen
import com.triviadeldestino.app.ui.screens.GroupGateScreen
import com.triviadeldestino.app.ui.screens.GroupGoneScreen
import com.triviadeldestino.app.ui.screens.HomeScreen
import com.triviadeldestino.app.ui.screens.LeaderboardScreen
import com.triviadeldestino.app.ui.screens.PlayScreen
import com.triviadeldestino.app.ui.screens.ProfileScreen
import com.triviadeldestino.app.ui.screens.SendChallengeScreen
import com.triviadeldestino.app.ui.screens.WelcomeScreen
import com.triviadeldestino.app.ui.theme.Carmesi
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import com.triviadeldestino.app.ui.theme.Pergamino
import com.triviadeldestino.app.ui.theme.Violeta
import kotlinx.serialization.Serializable

// Rutas tipadas de Navigation Compose (cada pantalla es un destino serializable).
@Serializable object Inicio
/** `n` = carta ya respondida que se quiere ver (−1: la carta en juego). */
@Serializable data class Jugar(val revelar: Boolean = false, val n: Int = -1)
@Serializable object Clasificacion
@Serializable object Perfil
@Serializable object Retar
@Serializable data class Reto(val id: String)
@Serializable object Ceremonia

/** Decide qué mostrar según la sesión: carga, error, perfil, grupo o la app. */
@Composable
fun TriviaRoot(vm: GameViewModel, quick: QuickViewModel) {
    val s by vm.state.collectAsStateWithLifecycle()
    val pendiente by vm.pendingJoin.collectAsStateWithLifecycle()
    val rapida by quick.ruta.collectAsStateWithLifecycle()
    var escaneando by rememberSaveable { mutableStateOf(false) }
    var escaneandoSala by rememberSaveable { mutableStateOf(false) }

    // Escáner del QR de una sala de Partida Rápida.
    if (escaneandoSala) {
        ScannerScreen(
            onCodigo = { codigo ->
                quick.ruta.value = RutaRapida.Sala(codigo)
                escaneandoSala = false
            },
            onCerrar = { escaneandoSala = false },
            parse = ::quickCodeFrom,
            titulo = "Escanear el QR de la sala",
        )
        return
    }

    // Escáner de QR (CameraX + ML Kit) sobre la pantalla de unirse.
    if (escaneando) {
        ScannerScreen(
            onCodigo = { codigo ->
                vm.pendingJoin.value = codigo
                escaneando = false
            },
            onCerrar = { escaneando = false },
        )
        return
    }

    Column(Modifier.fillMaxSize()) {
        OfflineBanner(s.online)
        // El aviso ya ocupa la barra de estado: lo de abajo no debe volver a dejar ese hueco.
        Box(Modifier.weight(1f).then(if (s.online) Modifier else Modifier.consumeWindowInsets(WindowInsets.statusBars))) {
            val grupoActual = s.profile?.grupoActual
            when {
                s.session == Session.Error -> StatusScreen("No pudimos conectar") {
                    ErrorBox(s.sessionError)
                    TriviaButton("Reintentar", vm::iniciarSesion)
                }
                s.session == Session.Conectando || !s.profileLoaded -> LoadingScreen()
                s.profile == null -> WelcomeScreen(vm, s.online)
                // Partida Rápida: independiente de los grupos (no hace falta tener uno).
                rapida != null -> QuickRoot(quick, s, rapida!!, onEscanear = { escaneandoSala = true })
                grupoActual == null || (pendiente != null && pendiente != grupoActual) -> GroupGateScreen(vm, s, pendiente, onEscanear = { escaneando = true }, onRapida = { quick.ruta.value = RutaRapida.Menu })
                s.groupData is GroupData.Error -> GroupGoneScreen(vm, (s.groupData as GroupData.Error).mensaje)
                s.group == null || s.group?.code != grupoActual -> LoadingScreen("Barajando el mazo…")
                else -> MainScaffold(vm, s, onRapida = { quick.ruta.value = RutaRapida.Menu })
            }
        }
    }
}

private data class Pestana(val ruta: Any, val etiqueta: String, val icono: Int)

private val Pestanas = listOf(
    Pestana(Inicio, "Inicio", R.drawable.ic_nav_inicio),
    Pestana(Clasificacion, "Clasificación", R.drawable.ic_nav_clasificacion),
    Pestana(Perfil, "Perfil", R.drawable.ic_nav_perfil),
)

@Composable
private fun MainScaffold(vm: GameViewModel, s: GameUiState, onRapida: () -> Unit) {
    val nav = rememberNavController()
    val entrada by nav.currentBackStackEntryAsState()
    val destino = entrada?.destination
    // Volver a Inicio quita de la pila lo que hubiera encima (pregunta, reto, ceremonia).
    // No se usa saveState/restoreState: restauraría la pila de Inicio y dejaría al jugador en la pregunta.
    fun irAInicio() {
        if (!nav.popBackStack(Inicio, inclusive = false)) nav.navigate(Inicio)
    }
    fun ir(ruta: Any) {
        if (ruta == Inicio) return irAInicio()
        nav.navigate(ruta) {
            popUpTo(nav.graph.findStartDestination().id)
            launchSingleTop = true
        }
    }
    // La pregunta, los retos y la ceremonia forman parte de la sección Inicio.
    fun pestanaActiva(p: Pestana): Boolean = when (p.ruta) {
        Inicio -> listOf(Inicio::class, Jugar::class, Retar::class, Reto::class, Ceremonia::class).any { destino?.hasRoute(it) == true }
        else -> destino?.hasRoute(p.ruta::class) == true
    }

    // Al terminar la semana, llevar una vez a la ceremonia (por grupo y temporada).
    var ceremoniaVista by rememberSaveable { mutableStateOf("") }
    val claveCeremonia = "${s.group?.code}-${s.group?.temporada}"
    LaunchedEffect(s.seasonOver, claveCeremonia) {
        if (s.seasonOver && ceremoniaVista != claveCeremonia) {
            ceremoniaVista = claveCeremonia
            nav.navigate(Ceremonia)
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = { Cabecera(s) },
        bottomBar = {
            NavigationBar(containerColor = Noche.copy(alpha = 0.95f)) {
                Pestanas.forEach { p ->
                    val activa = pestanaActiva(p)
                    NavigationBarItem(
                        selected = activa,
                        onClick = { ir(p.ruta) },
                        icon = { Icon(painterResource(p.icono), contentDescription = null) },
                        label = { TextoAjustable(p.etiqueta, MaterialTheme.typography.labelMedium, if (activa) OroClaro else Niebla) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = OroClaro,
                            selectedTextColor = OroClaro,
                            unselectedIconColor = Niebla,
                            unselectedTextColor = Niebla,
                            indicatorColor = Violeta.copy(alpha = 0.5f),
                        ),
                    )
                }
            }
        },
    ) { relleno ->
        Column(Modifier.padding(relleno)) {
            // Aviso de reto pendiente en todas las pantallas salvo la del propio reto.
            val reto = s.myPending.firstOrNull()
            if (reto != null && !s.seasonOver && destino?.hasRoute(Reto::class) != true) {
                Row(
                    Modifier
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .fillMaxWidth()
                        .border(1.dp, Carmesi, RoundedCornerShape(12.dp))
                        .background(Carmesi.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                        .clickable(role = Role.Button, onClickLabel = "Responder el reto") { nav.navigate(Reto(reto.id)) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val aviso = when (tipoReto(reto)) {
                        TipoReto.reto -> "${s.apodoDe(reto.de)} te lanzó un reto."
                        TipoReto.devuelto -> "${s.apodoDe(reto.para)} te devolvió tu reto."
                        TipoReto.doble -> "Tienes un doble reto pendiente."
                        TipoReto.extra -> "Te falta la 2.ª pregunta de tu doble reto."
                    }
                    Text("$aviso Es obligatorio antes de tu siguiente carta.", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                    Text("RESPONDER", color = OroClaro, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(start = 8.dp))
                }
            }
            NavHost(nav, startDestination = Inicio, modifier = Modifier.weight(1f)) {
                composable<Inicio> {
                    HomeScreen(
                        vm, s,
                        onRevelar = { nav.navigate(Jugar(revelar = true)) },
                        onVerJugada = { n -> nav.navigate(Jugar(n = n)) },
                        onResponderReto = { nav.navigate(Reto(it)) },
                        onRetar = { nav.navigate(Retar) },
                        onCeremonia = { nav.navigate(Ceremonia) },
                        onRapida = onRapida,
                    )
                }
                composable<Jugar> { e ->
                    val ruta = e.toRoute<Jugar>()
                    PlayScreen(vm, s, ruta.revelar, ruta.n.takeIf { it >= 0 }, onInicio = { ir(Inicio) }, onRetar = { nav.navigate(Retar) })
                }
                composable<Clasificacion> { LeaderboardScreen(s) }
                composable<Perfil> { ProfileScreen(vm, s) }
                composable<Retar> { SendChallengeScreen(vm, s, onInicio = { ir(Inicio) }) }
                composable<Reto> { e ->
                    ChallengePlayScreen(
                        vm, s, e.toRoute<Reto>().id,
                        onInicio = { ir(Inicio) },
                        // La 2.ª pregunta del doble reto reemplaza a la 1.ª en la pila.
                        onReto = { otro -> nav.navigate(Reto(otro)) { popUpTo<Reto> { inclusive = true } } },
                    )
                }
                composable<Ceremonia> { CeremonyScreen(s, onClasificacion = { ir(Clasificacion) }) }
            }
        }
    }
}

@Composable
private fun Cabecera(s: GameUiState) {
    // Dos filas: título + puntos arriba, grupo + día abajo. Así, con letra grande,
    // las etiquetas no le quitan ancho al título.
    val chip = Modifier.padding(start = 8.dp)
    Column(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextoAjustable(
                "Trivia del Destino",
                MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                OroClaro,
                Modifier.weight(1f),
            )
            s.myRow?.let {
                Text(
                    "${it.puntos} pts",
                    style = MaterialTheme.typography.labelMedium,
                    color = OroClaro,
                    maxLines = 1,
                    modifier = chip.background(Oro.copy(alpha = 0.15f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }
        Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                s.group?.nombre.orEmpty(),
                style = MaterialTheme.typography.bodySmall,
                color = Niebla,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                if (s.seasonOver) "Final" else "Día ${s.day + 1} de ${GameConfig.DEFAULT.diasTemporada}",
                style = MaterialTheme.typography.labelMedium,
                color = Pergamino,
                maxLines = 1,
                modifier = chip.border(1.dp, Oro.copy(alpha = 0.3f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
    }
}

/** Partida Rápida: menú (crear o unirse) o la sala. */
@Composable
private fun QuickRoot(quick: QuickViewModel, s: GameUiState, ruta: RutaRapida, onEscanear: () -> Unit) {
    val perfil = s.profile ?: return
    when (ruta) {
        RutaRapida.Menu -> {
            LaunchedEffect(Unit) { quick.cerrarVista() }
            QuickMenuScreen(
                quick, perfil, s.online,
                onSala = { quick.ruta.value = RutaRapida.Sala(it) },
                onEscanear = onEscanear,
                onVolver = { quick.ruta.value = null },
            )
        }
        is RutaRapida.Sala -> {
            LaunchedEffect(ruta.code, perfil.uid) { quick.abrir(ruta.code, perfil.uid, perfil.apodo, perfil.avatar) }
            val qs by quick.state.collectAsStateWithLifecycle()
            if (qs.code != ruta.code) LoadingScreen("Buscando la sala…")
            else QuickRoomScreen(
                quick, qs,
                onMenu = { quick.ruta.value = RutaRapida.Menu },
                onInicio = {
                    quick.cerrarVista()
                    quick.ruta.value = null
                },
            )
        }
    }
}
