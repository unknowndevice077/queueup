package com.queueup.common.web;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/** Stable pagination envelope so the API does not leak Spring Data internals. */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

  public static <T> PageResponse<T> from(Page<T> page) {
    return new PageResponse<>(
        page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
  }

  public static <S, T> PageResponse<T> from(Page<S> page, Function<S, T> mapper) {
    return from(page.map(mapper));
  }
}
