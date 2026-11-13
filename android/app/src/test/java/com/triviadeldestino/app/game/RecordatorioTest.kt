package com.triviadeldestino.app.game

import com.triviadeldestino.app.nativo.demoraHastaRecordatorio
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime

class RecordatorioTest {
    private val hora = LocalTime.of(19, 0)

    @Test
    fun programaParaHoySiAunNoEsLaHora() {
        assertEquals(Duration.ofHours(9), demoraHastaRecordatorio(LocalDateTime.of(2026, 10, 18, 10, 0), hora))
    }

    @Test
    fun programaParaMananaSiYaPasoOEsJustoLaHora() {
        assertEquals(Duration.ofHours(23), demoraHastaRecordatorio(LocalDateTime.of(2026, 10, 18, 20, 0), hora))
        assertEquals(Duration.ofHours(24), demoraHastaRecordatorio(LocalDateTime.of(2026, 10, 18, 19, 0), hora))
    }
}
