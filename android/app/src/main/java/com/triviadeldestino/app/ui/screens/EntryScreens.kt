package com.triviadeldestino.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.triviadeldestino.app.data.friendlyMessage
import com.triviadeldestino.app.game.APODO_MAX
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.CardId
import com.triviadeldestino.app.game.NOMBRE_GRUPO_MAX
import com.triviadeldestino.app.game.groupCodeFrom
import com.triviadeldestino.app.game.validateApodo
import com.triviadeldestino.app.game.validateGroupName
import com.triviadeldestino.app.ui.GameUiState
import com.triviadeldestino.app.ui.GameViewModel
import com.triviadeldestino.app.ui.cards.AvatarIcon
import com.triviadeldestino.app.ui.cards.CardBack
import com.triviadeldestino.app.ui.cards.TarotCard
import com.triviadeldestino.app.ui.quick.QuickMatchBanner
import com.triviadeldestino.app.ui.components.AvatarPicker
import com.triviadeldestino.app.ui.components.ErrorBox
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.OrnateFrame
import com.triviadeldestino.app.ui.components.StatusScreen
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.components.TriviaTextField
import com.triviadeldestino.app.ui.components.Variante
import com.triviadeldestino.app.ui.theme.Cinzel
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Oro
import com.triviadeldestino.app.ui.theme.OroClaro
import kotlinx.coroutines.launch

/** Bienvenida: sin registro, solo apodo y avatar. */
@Composable
fun WelcomeScreen(vm: GameViewModel, online: Boolean) {
    var apodo by rememberSaveable { mutableStateOf("") }
    var avatar by rememberSaveable { mutableStateOf(AvatarId.ESTRELLA) }
    var tocado by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var enviando by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun entrar() {
        tocado = true
        if (validateApodo(apodo) != null || enviando || !online) return
        enviando = true
        error = null
        scope.launch {
            vm.guardarPerfil(apodo, avatar).onFailure {
                error = it.friendlyMessage()
                enviando = false
            }
        }
    }

    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(12.dp))
        Box(Modifier.width(220.dp).height(170.dp), contentAlignment = Alignment.Center) {
            CardBack(Modifier.height(150.dp).offset(x = (-58).dp).rotate(-12f))
            CardBack(Modifier.height(150.dp).offset(x = 58.dp).rotate(12f))
            TarotCard(CardId.MUNDO, Modifier.height(160.dp))
        }
        Text("Trivia del Destino", style = MaterialTheme.typography.displayMedium, color = OroClaro, textAlign = TextAlign.Center)
        Text(
            "Cada día una carta del tarot elige tu pregunta. Acierta, reta a tus compañeros y conviértete en el Dueño del Destino.",
            color = Niebla,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 20.dp),
        )
        OrnateFrame(title = "¿Quién consulta las cartas?") {
            TriviaTextField(
                value = apodo,
                onValueChange = { apodo = it },
                label = "Tu apodo",
                placeholder = "Ej.: Luna Errante",
                maxLength = APODO_MAX,
                error = if (tocado) validateApodo(apodo) else null,
                hint = "Así te verán en la clasificación. Sin registro ni contraseña.",
                onDone = ::entrar,
            )
            Spacer(Modifier.height(16.dp))
            Text("Tu símbolo", style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(8.dp))
            AvatarPicker(avatar) { avatar = it }
            Spacer(Modifier.height(16.dp))
            ErrorBox(error)
            Spacer(Modifier.height(8.dp))
            TriviaButton(
                if (online) "Entrar" else "Sin conexión",
                onClick = ::entrar,
                loading = enviando,
                enabled = online,
                large = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Unirse con un código (o enlace/QR) o crear un grupo nuevo. */
@Composable
fun GroupGateScreen(vm: GameViewModel, s: GameUiState, pendiente: String?, onEscanear: (() -> Unit)?, onRapida: () -> Unit = {}) {
    val perfil = s.profile ?: return
    var codigo by rememberSaveable(pendiente) { mutableStateOf(pendiente ?: "") }
    var nombre by rememberSaveable { mutableStateOf("") }
    var juega by rememberSaveable { mutableStateOf(true) }
    var tocadoNombre by rememberSaveable { mutableStateOf(false) }
    var errorUnir by remember { mutableStateOf<String?>(null) }
    var errorCrear by remember { mutableStateOf<String?>(null) }
    var uniendo by remember { mutableStateOf(false) }
    var creando by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun unir() {
        if (groupCodeFrom(codigo) == null) {
            errorUnir = "El código tiene 5 caracteres: letras y números (sin 0, O, 1 ni I)."
            return
        }
        if (uniendo || !s.online) return
        uniendo = true
        errorUnir = null
        scope.launch {
            vm.unirse(codigo).onFailure {
                errorUnir = it.friendlyMessage()
                uniendo = false
            }
        }
    }

    fun crear() {
        tocadoNombre = true
        if (validateGroupName(nombre) != null || creando || !s.online) return
        creando = true
        errorCrear = null
        scope.launch {
            vm.crearGrupo(nombre, juega).onFailure {
                errorCrear = it.friendlyMessage()
                creando = false
            }
        }
    }

    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
            AvatarIcon(perfil.avatar, Modifier.width(56.dp), decorative = true)
            Column(Modifier.padding(start = 12.dp)) {
                Text("Hola,", color = Niebla)
                Text(perfil.apodo, style = MaterialTheme.typography.headlineLarge, color = OroClaro)
            }
        }

        if (pendiente != null && perfil.grupoActual != null && pendiente != perfil.grupoActual) {
            OrnateFrame {
                Text("Te invitaron al grupo $pendiente. Al unirte saldrás de tu grupo actual (${perfil.grupoActual}).")
                Spacer(Modifier.height(10.dp))
                TriviaButton("Quedarme donde estoy", { vm.pendingJoin.value = null }, variante = Variante.Fantasma)
            }
        }

        OrnateFrame(title = "Unirme a un grupo") {
            TriviaTextField(
                value = codigo,
                onValueChange = { codigo = it },
                label = "Código del grupo",
                placeholder = "A7K2Q",
                mayusculas = true,
                maxLength = 7,
                hint = "Pídeselo a quien creó el grupo, o escanea su QR.",
                textStyle = MaterialTheme.typography.headlineMedium.copy(letterSpacing = 8.sp, textAlign = TextAlign.Center),
                onDone = ::unir,
            )
            Spacer(Modifier.height(8.dp))
            ErrorBox(errorUnir)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TriviaButton(
                    "Unirme",
                    onClick = ::unir,
                    loading = uniendo,
                    enabled = s.online,
                    modifier = Modifier.weight(1f),
                )
                if (onEscanear != null) TriviaButton("Escanear QR", onEscanear, variante = Variante.Fantasma)
            }
        }

        OrnateFrame(title = "Crear un grupo") {
            TriviaTextField(
                value = nombre,
                onValueChange = { nombre = it },
                label = "Nombre del grupo",
                placeholder = "Ej.: Los Arcanos del Aula 12",
                maxLength = NOMBRE_GRUPO_MAX,
                error = if (tocadoNombre) validateGroupName(nombre) else null,
                hint = "Lo administrarás desde la web con una clave que verás después.",
                onDone = ::crear,
            )
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
                    .toggleable(value = juega, role = Role.Switch, onValueChange = { juega = it })
                    .semantics { toggleableState = ToggleableState(juega) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("También voy a jugar", modifier = Modifier.weight(1f))
                Switch(
                    checked = juega,
                    onCheckedChange = null,
                    colors = SwitchDefaults.colors(checkedTrackColor = Oro, checkedThumbColor = OroClaro),
                )
            }
            ErrorBox(errorCrear)
            Spacer(Modifier.height(8.dp))
            TriviaButton(
                "Crear grupo",
                onClick = ::crear,
                variante = Variante.Violeta,
                loading = creando,
                enabled = s.online,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (!s.online) Nota("Necesitas conexión para crear o unirte a un grupo.", Modifier.fillMaxWidth(), center = true)

        QuickMatchBanner(sinGrupo = true, onClick = onRapida)
    }
}

/** El grupo dejó de estar disponible (borrado, expulsión…). */
@Composable
fun GroupGoneScreen(vm: GameViewModel, mensaje: String) {
    var error by remember { mutableStateOf<String?>(null) }
    var cargando by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    StatusScreen("El grupo no está disponible") {
        Text(mensaje, color = Niebla, textAlign = TextAlign.Center)
        Spacer(Modifier.height(12.dp))
        ErrorBox(error)
        TriviaButton("Elegir otro grupo", {
            cargando = true
            scope.launch {
                vm.salir().onFailure { error = it.friendlyMessage() }
                cargando = false
            }
        }, loading = cargando)
    }
}

/** Clave de administración del grupo, para usarla en la web (solo la ve quien lo creó). */
@Composable
fun AdminKeyBox(clave: String?, code: String) {
    if (clave == null) return
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("CLAVE DE ADMINISTRACIÓN", style = MaterialTheme.typography.labelSmall, color = Niebla, letterSpacing = 3.sp)
        Text(clave, fontFamily = Cinzel, fontWeight = FontWeight.Bold, fontSize = 28.sp, letterSpacing = 6.sp, color = OroClaro)
        Nota(
            "Para avanzar días, añadir bots o mostrar la presentación, abre la web en la PC, elige «Administrar un grupo» y escribe el código $code y esta clave. Compártela solo con otros organizadores.",
            center = true,
        )
    }
}
