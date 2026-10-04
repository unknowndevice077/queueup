package com.queueup.analytics;

/** RFC 4180 escaping plus protection against spreadsheet formula injection. */
final class CsvCells {

  private CsvCells() {
  }

  static String escape(String value) {
    if (value == null) {
      return "";
    }
    String safe = value;
    if (!safe.isEmpty() && "=+-@\t\r".indexOf(safe.charAt(0)) >= 0) {
      safe = "'" + safe;
    }
    if (safe.contains(",") || safe.contains("\"") || safe.contains("\n") || safe.contains("\r")) {
      safe = "\"" + safe.replace("\"", "\"\"") + "\"";
    }
    return safe;
  }
}
