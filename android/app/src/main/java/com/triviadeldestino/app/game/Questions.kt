package com.triviadeldestino.app.game

import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = false }

/** Lee y valida el banco de preguntas (lanza IllegalArgumentException con un mensaje claro si algo no cuadra). */
fun parseQuestions(texto: String): List<Question> {
    val preguntas = json.decodeFromString<List<Question>>(texto)
    val ids = HashSet<String>()
    preguntas.forEach { q ->
        require(ids.add(q.id)) { "id repetido: ${q.id}" }
        require(CardId.fromNombre(q.carta) != null) { "${q.id}: carta desconocida '${q.carta}'" }
        require(q.opciones.size == 4) { "${q.id}: debe tener 4 opciones" }
        require(q.respuestaCorrecta in 0..3) { "${q.id}: respuestaCorrecta fuera de rango" }
        require(q.pregunta.isNotBlank() && q.explicacion.isNotBlank()) { "${q.id}: falta texto" }
    }
    return preguntas
}

/** Banco de preguntas indexado por id. */
class QuestionBank(val all: List<Question>) {
    private val porId = all.associateBy { it.id }

    operator fun get(id: String): Question? = porId[id]
}
