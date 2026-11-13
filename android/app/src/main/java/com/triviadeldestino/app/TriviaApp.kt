package com.triviadeldestino.app

import android.app.Application
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.triviadeldestino.app.data.AuthRepository
import com.triviadeldestino.app.data.GameRepository
import com.triviadeldestino.app.data.GroupRepository
import com.triviadeldestino.app.data.ProfileRepository
import com.triviadeldestino.app.data.QuickRepository
import com.triviadeldestino.app.data.RecordatorioRepository
import com.triviadeldestino.app.game.QuestionBank
import com.triviadeldestino.app.game.parseQuestions
import com.triviadeldestino.app.nativo.Efectos
import com.triviadeldestino.app.nativo.Preferencias
import com.triviadeldestino.app.nativo.crearCanalRecordatorio
import com.triviadeldestino.app.nativo.programarRecordatorio

/**
 * Contenedor de dependencias de la app (inyección manual, sin Hilt): crea una sola vez
 * los repositorios, el banco de preguntas y los servicios nativos; los ViewModels y las
 * pantallas los reciben desde aquí.
 */
class AppContainer(app: Application) {
    private val db = Firebase.firestore // con caché persistente: funciona sin conexión
    val auth = AuthRepository(Firebase.auth)
    val profiles = ProfileRepository(db)
    val groups = GroupRepository(db)
    val game = GameRepository(db)
    val recordatorio = RecordatorioRepository(db)
    val quick = QuickRepository(db)
    val preferencias = Preferencias(app)
    val efectos by lazy { Efectos(app, preferencias) }

    /** questions.json se copia a los assets al compilar (tarea copiarPreguntas de Gradle). */
    val questions: QuestionBank by lazy {
        QuestionBank(parseQuestions(app.assets.open("questions.json").bufferedReader().use { it.readText() }))
    }
}

class TriviaApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        crearCanalRecordatorio(this)
        // Si el jugador activó el recordatorio, se reprograma (por ejemplo, tras actualizar la app).
        if (container.preferencias.recordatorio.value) programarRecordatorio(this)
    }
}
