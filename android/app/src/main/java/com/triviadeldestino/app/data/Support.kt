package com.triviadeldestino.app.data

import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.FirebaseFirestoreException.Code

/**
 * Reloj del servidor: las reglas calculan el día con la hora del servidor, así que el cliente
 * corrige el desfase del reloj del teléfono (igual que src/services/clock.ts).
 */
object ServerClock {
    @Volatile
    private var offsetMs = 0L

    fun now(): Long = System.currentTimeMillis() + offsetMs

    /** Ajusta el desfase con una marca de tiempo del servidor y el intervalo local en que se pidió. */
    fun sync(serverMs: Long, localStartMs: Long, localEndMs: Long) {
        offsetMs = serverMs - (localStartMs + localEndMs) / 2
    }
}

/** Error con un mensaje listo para mostrar (en español). */
class GameException(message: String) : Exception(message)

/** Convierte cualquier error en un mensaje claro para la interfaz. */
fun Throwable.friendlyMessage(porDefecto: String = "Algo salió mal. Inténtalo de nuevo."): String = when (this) {
    is GameException -> message ?: porDefecto
    is FirebaseFirestoreException -> when (code) {
        Code.PERMISSION_DENIED -> "No tienes permiso para hacer eso."
        Code.UNAVAILABLE -> "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."
        Code.DEADLINE_EXCEEDED -> "El servidor tardó demasiado en responder. Inténtalo de nuevo."
        Code.NOT_FOUND -> "No se encontró lo que buscabas."
        Code.RESOURCE_EXHAUSTED -> "Se alcanzó el límite gratuito de Firebase por hoy."
        else -> porDefecto
    }
    is FirebaseNetworkException -> "No hay conexión a internet."
    is FirebaseAuthException -> when (errorCode) {
        "ERROR_OPERATION_NOT_ALLOWED", "ERROR_ADMIN_RESTRICTED_OPERATION" -> "El inicio de sesión anónimo no está activado en Firebase."
        else -> "No se pudo iniciar la sesión."
    }
    is kotlinx.coroutines.TimeoutCancellationException -> "No hay conexión con el servidor. Inténtalo de nuevo."
    else -> porDefecto
}

fun Throwable.isPermissionDenied(): Boolean = this is FirebaseFirestoreException && code == Code.PERMISSION_DENIED
