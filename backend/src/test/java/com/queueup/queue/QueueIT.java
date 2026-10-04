package com.queueup.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.queue.dto.PublicQueueState;
import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures.Shop;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

class QueueIT extends IntegrationTest {

  @MockitoSpyBean
  private SimpMessagingTemplate messagingTemplate;

  private Shop shop;

  @BeforeEach
  void setUp() {
    shop = fixtures.shop("kanto");
  }

  @Test
  void walkInsGetSequentialTicketsAndThePublicViewHidesContactDetails() throws Exception {
    join("Juan", "09171112222").andExpect(status().isCreated())
        .andExpect(jsonPath("$.ticketNumber").value(1))
        .andExpect(jsonPath("$.position").value(1));
    join("Maria", "09173334444").andExpect(status().isCreated())
        .andExpect(jsonPath("$.ticketNumber").value(2))
        .andExpect(jsonPath("$.position").value(2));

    String publicView = mockMvc.perform(get("/api/public/tenants/kanto/queue"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.waitingCount").value(2))
        .andExpect(jsonPath("$.entries[1].ticketNumber").value(2))
        .andReturn().getResponse().getContentAsString();
    assertThat(publicView).doesNotContain("0917").doesNotContain("Juan").doesNotContain("Maria");
  }

  @Test
  void staffCallServeFinishAndSkipBroadcastingEachChange() throws Exception {
    join("Juan", "09171112222");
    join("Maria", "09173334444");

    String firstId = json(mockMvc.perform(post("/api/t/kanto/queue/call-next")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ticketNumber").value(1))
        .andExpect(jsonPath("$.status").value("CALLED"))
        .andReturn()).get("id").asText();
    mockMvc.perform(post("/api/t/kanto/queue/" + firstId + "/serve").header("Authorization",
        bearer(shop.ownerToken()))).andExpect(jsonPath("$.status").value("SERVING"));
    mockMvc.perform(post("/api/t/kanto/queue/" + firstId + "/done").header("Authorization",
        bearer(shop.ownerToken()))).andExpect(jsonPath("$.status").value("DONE"));
    mockMvc.perform(post("/api/t/kanto/queue/" + firstId + "/skip").header("Authorization",
        bearer(shop.ownerToken()))).andExpect(status().isConflict());

    String secondId = json(mockMvc.perform(post("/api/t/kanto/queue/call-next")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(jsonPath("$.ticketNumber").value(2)).andReturn()).get("id").asText();
    mockMvc.perform(post("/api/t/kanto/queue/" + secondId + "/skip").header("Authorization",
        bearer(shop.ownerToken()))).andExpect(jsonPath("$.status").value("SKIPPED"));
    mockMvc.perform(post("/api/t/kanto/queue/call-next").header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isNotFound());

    mockMvc.perform(get("/api/t/kanto/queue").header("Authorization", bearer(shop.ownerToken())))
        .andExpect(jsonPath("$[0].customerPhone").value("09171112222"))
        .andExpect(jsonPath("$[0].status").value("DONE"));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Object> payloads = ArgumentCaptor.forClass(Object.class);
    verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/tenants/kanto/queue"), payloads.capture());
    assertThat(payloads.getAllValues()).hasSizeGreaterThanOrEqualTo(7);
    PublicQueueState last = (PublicQueueState) payloads.getValue();
    assertThat(last.waitingCount()).isZero();
    assertThat(last.entries()).extracting(PublicQueueState.Entry::status)
        .containsExactly(QueueStatus.DONE, QueueStatus.SKIPPED);
  }

  @Test
  void rejectsInvalidWalkInDetails() throws Exception {
    join("", "abc").andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[?(@.field == 'customerName')]").exists())
        .andExpect(jsonPath("$.errors[?(@.field == 'customerPhone')]").exists());
    verify(messagingTemplate, org.mockito.Mockito.never()).convertAndSend(any(String.class), any(Object.class));
  }

  private org.springframework.test.web.servlet.ResultActions join(String name, String phone) throws Exception {
    return mockMvc.perform(post("/api/public/tenants/kanto/queue/join")
        .contentType(MediaType.APPLICATION_JSON)
        .content(toJson(Map.of("customerName", name, "customerPhone", phone))));
  }
}
