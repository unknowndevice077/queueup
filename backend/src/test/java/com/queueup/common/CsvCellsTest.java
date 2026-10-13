package com.queueup.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CsvCellsTest {

  @Test
  void quotesCommasAndQuotes() {
    assertThat(CsvCells.escape("Santos, Ana")).isEqualTo("\"Santos, Ana\"");
    assertThat(CsvCells.escape("The \"Pro\" Cut")).isEqualTo("\"The \"\"Pro\"\" Cut\"");
  }

  @Test
  void neutralisesSpreadsheetFormulas() {
    assertThat(CsvCells.escape("=HYPERLINK(\"x\")")).startsWith("\"'=");
    assertThat(CsvCells.escape("+63 917")).isEqualTo("'+63 917");
  }

  @Test
  void handlesNullAndPlainValues() {
    assertThat(CsvCells.escape(null)).isEmpty();
    assertThat(CsvCells.escape("Haircut")).isEqualTo("Haircut");
  }
}
