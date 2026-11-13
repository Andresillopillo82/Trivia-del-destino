package com.triviadeldestino.app.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.triviadeldestino.app.game.AnswerEvent
import com.triviadeldestino.app.game.AnswerResult
import com.triviadeldestino.app.game.AnswerState
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.CardId
import com.triviadeldestino.app.game.ChallengeEvent
import com.triviadeldestino.app.game.ChallengeState
import com.triviadeldestino.app.game.PlayerInfo

/**
 * Documentos de Firestore: espejo exacto de src/services/docs.ts de la web.
 * firestore.rules valida estos nombres y tipos; si algo difiere, la escritura se rechaza.
 */

object Paths {
    fun user(uid: String) = "users/$uid"
    fun group(code: String) = "groups/$code"
    fun players(code: String) = "groups/$code/players"
    fun player(code: String, uid: String) = "groups/$code/players/$uid"
    fun answers(code: String) = "groups/$code/answers"
    fun answer(code: String, uid: String, dia: Int, n: Int) = "groups/$code/answers/${uid}_${dia}_$n"
    fun challenges(code: String) = "groups/$code/challenges"
    fun challenge(code: String, id: String) = "groups/$code/challenges/$id"
    fun adminKey(code: String) = "groups/$code/secretos/admin"
    fun coAdmin(code: String, uid: String) = "groups/$code/admins/$uid"
}

// ---------- modelos de lectura ----------

data class UserProfile(val uid: String, val apodo: String, val avatar: AvatarId, val grupoActual: String?)

data class TitleHolder(val uid: String, val apodo: String, val avatar: AvatarId, val puntos: Int)

data class Group(
    val code: String,
    val nombre: String,
    val adminUid: String,
    val adminJuega: Boolean,
    val fechaInicioMs: Long,
    val dayOffset: Int,
    val finalizado: Boolean,
    val temporada: Int,
    val campeon: TitleHolder?,
)

// ---------- escritura ----------

fun userDoc(apodo: String, avatar: AvatarId, grupoActual: String?): Map<String, Any?> = mapOf(
    "apodo" to apodo,
    "avatar" to avatar.id,
    "grupoActual" to grupoActual,
    "vistoEn" to FieldValue.serverTimestamp(),
)

fun newGroupDoc(adminUid: String, nombre: String, adminJuega: Boolean, fechaInicioMs: Long): Map<String, Any?> = mapOf(
    "nombre" to nombre,
    "adminUid" to adminUid,
    "adminJuega" to adminJuega,
    "fechaInicio" to Timestamp(fechaInicioMs / 1000, ((fechaInicioMs % 1000) * 1_000_000).toInt()),
    "dayOffset" to 0,
    "estado" to "activo",
    "temporada" to 1,
    "campeon" to null,
    "titulos" to null,
    "creadoEn" to FieldValue.serverTimestamp(),
)

fun adminKeyDoc(clave: String): Map<String, Any?> = mapOf("clave" to clave)

fun humanPlayerDoc(apodo: String, avatar: AvatarId): Map<String, Any?> = mapOf(
    "apodo" to apodo,
    "avatar" to avatar.id,
    "esBot" to false,
    "unidoEn" to FieldValue.serverTimestamp(),
)

/** Carta volteada: aún sin pregunta (se elige al abrirla) y con el comodín disponible. */
fun cardAnswerDoc(uid: String, dia: Int, n: Int, carta: CardId): Map<String, Any?> = mapOf(
    "uid" to uid,
    "dia" to dia,
    "n" to n,
    "preguntaId" to null,
    "carta" to carta.id,
    "comodin" to false,
    "estado" to "carta",
    "opcion" to null,
    "correcta" to false,
    "tiempoMs" to 0,
    "retoPara" to null,
    "cartaEn" to FieldValue.serverTimestamp(),
    "reveladoEn" to null,
)

/** Comodín: cambia la carta antes de ver la pregunta (una vez al día). */
fun comodinPatch(carta: CardId): Map<String, Any?> = mapOf("carta" to carta.id, "comodin" to true)

/** "Ver la pregunta": fija la pregunta y la hora del servidor desde la que corre el tiempo. */
fun openAnswerPatch(preguntaId: String): Map<String, Any?> = mapOf(
    "estado" to "abierta",
    "preguntaId" to preguntaId,
    "reveladoEn" to FieldValue.serverTimestamp(),
)

fun closeAnswerPatch(r: AnswerResult): Map<String, Any?> = mapOf(
    "estado" to "cerrada",
    "opcion" to r.opcion,
    "correcta" to r.correcta,
    "tiempoMs" to r.tiempoMs,
    "respondidoEn" to FieldValue.serverTimestamp(),
)

/** Reto lanzado por un jugador; `respuestaN` es la respuesta del día que lo desbloqueó. */
fun newChallengeDoc(de: String, para: String, dia: Int, preguntaId: String, carta: CardId, respuestaN: Int): Map<String, Any?> = mapOf(
    "de" to de,
    "para" to para,
    "dia" to dia,
    "preguntaId" to preguntaId,
    "carta" to carta.id,
    "estado" to "pendiente",
    "extra" to false,
    "devueltoEn" to null,
    "respuestaN" to respuestaN,
    "correcta" to null,
    "tiempoMs" to null,
    "creadoEn" to FieldValue.serverTimestamp(),
)

/** Devolver el reto: la hora del servidor decide si sale bien (devolucionExitosa). */
fun returnChallengePatch(): Map<String, Any?> = mapOf("estado" to "devuelto", "devueltoEn" to FieldValue.serverTimestamp())

/** Segunda pregunta del doble reto; se escribe en el mismo lote que la devolución. */
fun extraChallengeDoc(de: String, para: String, dia: Int, preguntaId: String, carta: CardId): Map<String, Any?> = mapOf(
    "de" to de,
    "para" to para,
    "dia" to dia,
    "preguntaId" to preguntaId,
    "carta" to carta.id,
    "estado" to "pendiente",
    "extra" to true,
    "devueltoEn" to null,
    "correcta" to null,
    "tiempoMs" to null,
    "creadoEn" to FieldValue.serverTimestamp(),
)

fun openChallengePatch(): Map<String, Any?> = mapOf("estado" to "abierto", "abiertoEn" to FieldValue.serverTimestamp())

fun resolveChallengePatch(r: AnswerResult): Map<String, Any?> = mapOf(
    "estado" to "resuelto",
    "opcion" to r.opcion,
    "correcta" to r.correcta,
    "tiempoMs" to r.tiempoMs,
    "resueltoEn" to FieldValue.serverTimestamp(),
)

// ---------- lectura ----------

private fun DocumentSnapshot.millis(
    campo: String,
    comportamiento: DocumentSnapshot.ServerTimestampBehavior = DocumentSnapshot.ServerTimestampBehavior.ESTIMATE,
): Long? = getTimestamp(campo, comportamiento)?.toDate()?.time

fun DocumentSnapshot.toUser(): UserProfile = UserProfile(
    uid = id,
    apodo = getString("apodo").orEmpty(),
    avatar = AvatarId.fromId(getString("avatar")),
    grupoActual = getString("grupoActual"),
)

@Suppress("UNCHECKED_CAST")
private fun holder(v: Any?): TitleHolder? {
    val m = v as? Map<String, Any?> ?: return null
    return TitleHolder(
        uid = m["uid"] as? String ?: "",
        apodo = m["apodo"] as? String ?: "",
        avatar = AvatarId.fromId(m["avatar"] as? String),
        puntos = (m["puntos"] as? Number)?.toInt() ?: 0,
    )
}

fun DocumentSnapshot.toGroup(): Group = Group(
    code = id,
    nombre = getString("nombre").orEmpty(),
    adminUid = getString("adminUid").orEmpty(),
    adminJuega = getBoolean("adminJuega") != false,
    fechaInicioMs = millis("fechaInicio") ?: 0L,
    dayOffset = getLong("dayOffset")?.toInt() ?: 0,
    finalizado = getString("estado") == "finalizado",
    temporada = getLong("temporada")?.toInt() ?: 1,
    campeon = holder(get("campeon")),
)

fun DocumentSnapshot.toPlayer(): PlayerInfo = PlayerInfo(
    uid = id,
    apodo = getString("apodo").orEmpty(),
    avatar = AvatarId.fromId(getString("avatar")),
    esBot = getBoolean("esBot") == true,
)

fun DocumentSnapshot.toAnswer(): AnswerEvent? {
    val carta = CardId.fromId(getString("carta") ?: return null) ?: return null
    return AnswerEvent(
        uid = getString("uid") ?: return null,
        dia = getLong("dia")?.toInt() ?: return null,
        n = getLong("n")?.toInt() ?: 0,
        preguntaId = getString("preguntaId"),
        carta = carta,
        comodin = getBoolean("comodin") == true,
        estado = when (getString("estado")) {
            "cerrada" -> AnswerState.cerrada
            "abierta" -> AnswerState.abierta
            else -> AnswerState.carta
        },
        opcion = getLong("opcion")?.toInt(),
        correcta = getBoolean("correcta") == true,
        tiempoMs = getLong("tiempoMs") ?: 0L,
        retoPara = getString("retoPara"),
        reveladoEnMs = millis("reveladoEn"),
    )
}

fun DocumentSnapshot.toChallenge(): ChallengeEvent? {
    val carta = CardId.fromId(getString("carta") ?: return null) ?: return null
    return ChallengeEvent(
        id = id,
        de = getString("de") ?: return null,
        para = getString("para") ?: return null,
        dia = getLong("dia")?.toInt() ?: return null,
        preguntaId = getString("preguntaId").orEmpty(),
        carta = carta,
        estado = when (getString("estado")) {
            "resuelto" -> ChallengeState.resuelto
            "abierto" -> ChallengeState.abierto
            "devuelto" -> ChallengeState.devuelto
            else -> ChallengeState.pendiente
        },
        extra = getBoolean("extra") == true,
        // Sin estimar: mientras la devolución no se confirma es null, así nadie ve un resultado
        // calculado con una hora local provisional.
        devueltoEnMs = millis("devueltoEn", DocumentSnapshot.ServerTimestampBehavior.NONE),
        correcta = getBoolean("correcta"),
        tiempoMs = getLong("tiempoMs"),
        abiertoEnMs = millis("abiertoEn"),
    )
}
