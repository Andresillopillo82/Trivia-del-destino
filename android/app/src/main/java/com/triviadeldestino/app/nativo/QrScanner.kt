package com.triviadeldestino.app.nativo

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.triviadeldestino.app.game.groupCodeFrom
import com.triviadeldestino.app.ui.components.Nota
import com.triviadeldestino.app.ui.components.TriviaButton
import com.triviadeldestino.app.ui.components.Variante
import com.triviadeldestino.app.ui.theme.Niebla
import com.triviadeldestino.app.ui.theme.Noche
import com.triviadeldestino.app.ui.theme.OroClaro
import kotlinx.coroutines.tasks.await
import java.util.concurrent.Executors

/** Decodifica códigos QR con ML Kit (en el propio teléfono, sin enviar imágenes a ningún servidor). */
class QrDecoder {
    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build(),
    )

    /** Textos de los QR encontrados en la imagen. */
    suspend fun textos(imagen: InputImage): List<String> = scanner.process(imagen).await().mapNotNull { it.rawValue }

    /** Código de grupo (A7K2Q) si la imagen contiene un QR de invitación o un código. */
    suspend fun codigoDeGrupo(imagen: InputImage): String? = textos(imagen).firstNotNullOfOrNull(::groupCodeFrom)

    internal fun cliente() = scanner

    fun cerrar() = scanner.close()
}

/**
 * Escáner de QR a pantalla completa (CameraX + ML Kit). Pide el permiso de cámara explicando
 * para qué es; si se deniega, ofrece abrir los ajustes o escribir el código a mano.
 */
@Composable
fun ScannerScreen(
    onCodigo: (String) -> Unit,
    onCerrar: () -> Unit,
    /** Extrae el código del texto del QR (grupo por defecto; la Partida Rápida usa quickCodeFrom). */
    parse: (String) -> String? = ::groupCodeFrom,
    titulo: String = "Escanear el QR del grupo",
) {
    val context = LocalContext.current
    var permitido by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var denegado by remember { mutableStateOf(false) }
    val pedir = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        permitido = ok
        denegado = !ok
    }

    Box(Modifier.fillMaxSize().background(Noche)) {
        if (permitido) {
            CamaraConAnalisis(onCodigo, parse)
            Visor()
        } else {
            Column(
                Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(titulo, style = MaterialTheme.typography.headlineMedium, color = OroClaro, textAlign = TextAlign.Center)
                Spacer(Modifier.height(12.dp))
                Text(
                    "Para leer el código QR de la pantalla del stand necesitamos la cámara. Solo se usa mientras esta pantalla está abierta y las imágenes no salen de tu teléfono.",
                    color = Niebla,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(20.dp))
                val actividad = context as? Activity
                val permanente = denegado && actividad != null && !actividad.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)
                if (permanente) {
                    Nota("El permiso de cámara está desactivado. Puedes activarlo en los ajustes de la app.", center = true)
                    Spacer(Modifier.height(12.dp))
                    TriviaButton("Abrir ajustes", {
                        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)))
                    })
                } else {
                    TriviaButton("Permitir cámara", { pedir.launch(Manifest.permission.CAMERA) }, large = true)
                }
            }
        }
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            TriviaButton("Escribir el código a mano", onCerrar, variante = Variante.Fantasma)
        }
    }
}

@OptIn(ExperimentalGetImage::class)
@Composable
private fun CamaraConAnalisis(onCodigo: (String) -> Unit, parse: (String) -> String?) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val decoder = remember { QrDecoder() }
    val hilo = remember { Executors.newSingleThreadExecutor() }
    var aviso by remember { mutableStateOf<String?>(null) }
    var encontrado by remember { mutableStateOf(false) }
    val vista = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }

    DisposableEffect(lifecycleOwner) {
        val futuro = ProcessCameraProvider.getInstance(context)
        futuro.addListener({
            val proveedor = futuro.get()
            val preview = Preview.Builder().build().also { it.surfaceProvider = vista.surfaceProvider }
            val analisis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { a ->
                    a.setAnalyzer(hilo) { cuadro ->
                        val media = cuadro.image
                        if (media == null || encontrado) {
                            cuadro.close()
                            return@setAnalyzer
                        }
                        val imagen = InputImage.fromMediaImage(media, cuadro.imageInfo.rotationDegrees)
                        decoder.cliente().process(imagen)
                            .addOnSuccessListener { codigos ->
                                val textos = codigos.mapNotNull { it.rawValue }
                                val codigo = textos.firstNotNullOfOrNull(parse)
                                when {
                                    codigo != null && !encontrado -> {
                                        encontrado = true
                                        onCodigo(codigo)
                                    }
                                    textos.isNotEmpty() -> aviso = "Ese QR no es de la Trivia del Destino."
                                }
                            }
                            .addOnCompleteListener { cuadro.close() }
                    }
                }
            proveedor.unbindAll()
            proveedor.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analisis)
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            runCatching { futuro.get().unbindAll() }
            hilo.shutdown()
            decoder.cerrar()
        }
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView({ vista }, Modifier.fillMaxSize())
        aviso?.let {
            Text(
                it,
                color = OroClaro,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(24.dp)
                    .background(Noche.copy(alpha = 0.8f), RoundedCornerShape(12.dp))
                    .padding(12.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
}

/** Marco dorado que indica dónde apuntar. */
@Composable
private fun Visor() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(250.dp)) {
            val l = size.width
            val t = 36.dp.toPx()
            val w = 4.dp.toPx()
            val oro = OroClaro
            listOf(
                Offset(0f, 0f) to Offset(t, 0f), Offset(0f, 0f) to Offset(0f, t),
                Offset(l, 0f) to Offset(l - t, 0f), Offset(l, 0f) to Offset(l, t),
                Offset(0f, l) to Offset(t, l), Offset(0f, l) to Offset(0f, l - t),
                Offset(l, l) to Offset(l - t, l), Offset(l, l) to Offset(l, l - t),
            ).forEach { (a, b) -> drawLine(oro, a, b, w, StrokeCap.Round) }
        }
        Text("Apunta al código QR del grupo", color = OroClaro, modifier = Modifier.padding(top = 300.dp))
    }
}
