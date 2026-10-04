package com.queueup.common;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/** Formats integer centavos for humans, e.g. 123450 becomes "₱1,234.50". */
public final class MoneyFormat {

  private MoneyFormat() {
  }

  public static String peso(long centavos) {
    DecimalFormat format = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));
    return "₱" + format.format(BigDecimal.valueOf(centavos, 2));
  }
}
