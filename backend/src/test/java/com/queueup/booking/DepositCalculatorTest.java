package com.queueup.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

class DepositCalculatorTest {

  @ParameterizedTest(name = "{0} centavos at {1}% -> {2}")
  @CsvSource({
    "150000, 20, 30000",
    "25000, 20, 5000",
    "99999, 20, 20000",
    "99997, 20, 19999",
    "1, 50, 1",
    "80000, 100, 80000",
    "12345, 33, 4074"
  })
  void computesPercentRoundedHalfUp(long price, int percent, long expected) {
    assertThat(DepositCalculator.depositCentavos(price, true, percent)).isEqualTo(expected);
  }

  @Test
  void zeroWhenDepositNotRequired() {
    assertThat(DepositCalculator.depositCentavos(150_000, false, 20)).isZero();
  }

  @Test
  void zeroForFreeServicesOrZeroPercent() {
    assertThat(DepositCalculator.depositCentavos(0, true, 20)).isZero();
    assertThat(DepositCalculator.depositCentavos(150_000, true, 0)).isZero();
  }

  @Test
  void rejectsPercentAboveHundred() {
    assertThatThrownBy(() -> DepositCalculator.depositCentavos(100, true, 101))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
