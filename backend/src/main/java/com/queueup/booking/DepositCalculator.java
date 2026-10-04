package com.queueup.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Deposit amounts in centavos. Rounded half-up to the nearest centavo. */
public final class DepositCalculator {

  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private DepositCalculator() {
  }

  public static long depositCentavos(long priceCentavos, boolean depositRequired, int depositPercent) {
    if (!depositRequired || depositPercent <= 0 || priceCentavos <= 0) {
      return 0;
    }
    if (depositPercent > 100) {
      throw new IllegalArgumentException("depositPercent must be at most 100");
    }
    return BigDecimal.valueOf(priceCentavos)
        .multiply(BigDecimal.valueOf(depositPercent))
        .divide(HUNDRED, 0, RoundingMode.HALF_UP)
        .longValueExact();
  }
}
