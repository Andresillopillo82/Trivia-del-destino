package com.triviadeldestino.app.game

/**
 * Arcanos mayores del juego y la categoría que representa cada uno.
 * Mismo contenido que src/game/cards.ts de la web; `id` es el valor que se guarda en Firestore.
 */
enum class CardId(val id: String, val nombre: String, val numeral: String, val categoria: String) {
    LOCO("loco", "El Loco", "0", "Matemáticas"),
    MAGO("mago", "El Mago", "I", "Ciencia y tecnología"),
    SACERDOTISA("sacerdotisa", "La Sacerdotisa", "II", "Literatura"),
    EMPERATRIZ("emperatriz", "La Emperatriz", "III", "Naturaleza y biología"),
    EMPERADOR("emperador", "El Emperador", "IV", "Historia"),
    ENAMORADOS("enamorados", "Los Enamorados", "VI", "Música y cine"),
    CARRO("carro", "El Carro", "VII", "Deportes"),
    ERMITANO("ermitano", "El Ermitaño", "IX", "Filosofía y mitología"),
    RUEDA("rueda", "La Rueda de la Fortuna", "X", "Cultura pop y videojuegos"),
    MUNDO("mundo", "El Mundo", "XXI", "Geografía");

    companion object {
        fun fromId(id: String): CardId? = entries.firstOrNull { it.id == id }

        /** Busca la carta por el nombre usado en questions.json ("El Loco"). */
        fun fromNombre(nombre: String): CardId? = entries.firstOrNull { it.nombre == nombre }
    }
}

/** Símbolos de tarot que los jugadores eligen como avatar (mismos ids que la web). */
enum class AvatarId(val id: String, val nombre: String) {
    SOL("sol", "Sol"),
    LUNA("luna", "Luna"),
    ESTRELLA("estrella", "Estrella"),
    OJO("ojo", "Ojo"),
    LLAVE("llave", "Llave"),
    COPA("copa", "Copa"),
    ESPADA("espada", "Espada"),
    PENTACULO("pentaculo", "Pentáculo"),
    VELA("vela", "Vela"),
    ROSA("rosa", "Rosa");

    companion object {
        /** Si el valor guardado no es válido, se usa la estrella (igual que la web). */
        fun fromId(id: String?): AvatarId = entries.firstOrNull { it.id == id } ?: ESTRELLA
    }
}
