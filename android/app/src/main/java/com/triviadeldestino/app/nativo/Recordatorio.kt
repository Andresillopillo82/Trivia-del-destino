package com.triviadeldestino.app.nativo

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import com.triviadeldestino.app.MainActivity
import com.triviadeldestino.app.R
import com.triviadeldestino.app.TriviaApp
import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.concurrent.TimeUnit

const val CANAL_RECORDATORIO = "recordatorio-diario"
const val TRABAJO_RECORDATORIO = "recordatorio-diario"
const val ID_NOTIFICACION_RECORDATORIO = 1001
private val HORA_RECORDATORIO: LocalTime = LocalTime.of(19, 0)

/** Canal de notificaciones (obligatorio desde Android 8). */
fun crearCanalRecordatorio(context: Context) {
    val canal = NotificationChannel(CANAL_RECORDATORIO, "Recordatorio diario", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Te avisa si aún te quedan cartas por jugar ese día."
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
}

/** Tiempo hasta la próxima hora del recordatorio (hoy o mañana). */
fun demoraHastaRecordatorio(ahora: LocalDateTime = LocalDateTime.now(), hora: LocalTime = HORA_RECORDATORIO): Duration {
    var objetivo = ahora.toLocalDate().atTime(hora)
    if (!objetivo.isAfter(ahora)) objetivo = objetivo.plusDays(1)
    return Duration.between(ahora, objetivo)
}

/** Programa el recordatorio cada 24 h a partir de la próxima hora indicada (solo con conexión). */
fun programarRecordatorio(context: Context) {
    val trabajo = PeriodicWorkRequestBuilder<RecordatorioWorker>(24, TimeUnit.HOURS)
        .setInitialDelay(demoraHastaRecordatorio().toMillis(), TimeUnit.MILLISECONDS)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(TRABAJO_RECORDATORIO, ExistingPeriodicWorkPolicy.UPDATE, trabajo)
}

fun cancelarRecordatorio(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(TRABAJO_RECORDATORIO)
}

fun puedeNotificar(context: Context): Boolean =
    Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

/** Trabajo en segundo plano (WorkManager): consulta Firestore y avisa solo si aún no jugó hoy. */
class RecordatorioWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as TriviaApp
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return Result.success()
        val mensaje = runCatching { app.container.recordatorio.mensaje(uid) }.getOrElse { return Result.retry() }
        if (mensaje != null && puedeNotificar(applicationContext)) mostrar(applicationContext, mensaje)
        return Result.success()
    }

    private fun mostrar(context: Context, texto: String) {
        val abrir = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notificacion = NotificationCompat.Builder(context, CANAL_RECORDATORIO)
            .setSmallIcon(R.drawable.ic_nav_inicio)
            .setColor(0xFFD4AF37.toInt())
            .setContentTitle("Tus cartas del día te esperan")
            .setContentText(texto)
            .setStyle(NotificationCompat.BigTextStyle().bigText(texto))
            .setContentIntent(abrir)
            .setAutoCancel(true)
            .build()
        if (puedeNotificar(context)) {
            @Suppress("MissingPermission")
            NotificationManagerCompat.from(context).notify(ID_NOTIFICACION_RECORDATORIO, notificacion)
        }
    }
}
