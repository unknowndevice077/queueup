package com.queueup.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Ten customers race for the same slot with the same staff member: exactly one wins, nine get 409. */
class BookingConcurrencyIT extends IntegrationTest {

  private static final int CONTENDERS = 10;

  @Test
  void exactlyOneOfTenParallelRequestsForTheSameSlotSucceeds() throws Exception {
    Shop shop = fixtures.shop("race");
    List<String> tokens = new ArrayList<>();
    for (int i = 0; i < CONTENDERS; i++) {
      tokens.add(fixtures.token(fixtures.user("racer" + i + "@race.test")));
    }
    String body = toJson(Map.of(
        "serviceId", shop.service().getId(),
        "staffId", shop.ownerMembership().getId(),
        "startsAt", TestFixtures.iso(TestFixtures.futureSlot(2, 10))));

    CountDownLatch startGun = new CountDownLatch(1);
    ExecutorService pool = Executors.newFixedThreadPool(CONTENDERS);
    List<Future<Integer>> results = new ArrayList<>();
    for (String token : tokens) {
      Callable<Integer> attempt = () -> {
        startGun.await();
        return mockMvc.perform(post("/api/t/race/bookings")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andReturn().getResponse().getStatus();
      };
      results.add(pool.submit(attempt));
    }
    startGun.countDown();
    List<Integer> statuses = new ArrayList<>();
    for (Future<Integer> result : results) {
      statuses.add(result.get(60, TimeUnit.SECONDS));
    }
    pool.shutdown();

    assertThat(statuses).filteredOn(s -> s == 201).hasSize(1);
    assertThat(statuses).filteredOn(s -> s == 409).hasSize(CONTENDERS - 1);
    assertThat(jdbc.queryForObject("select count(*) from booking where status = 'CONFIRMED'", Integer.class))
        .isEqualTo(1);
  }
}
