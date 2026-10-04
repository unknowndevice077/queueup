package com.queueup.schedule;

import com.queueup.common.exception.BadRequestException;
import com.queueup.schedule.dto.WorkingHoursRange;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkingHoursService {

  private final WorkingHoursRepository repository;

  public WorkingHoursService(WorkingHoursRepository repository) {
    this.repository = repository;
  }

  /** Replaces a staff member's full weekly schedule after validating it. */
  @Transactional
  public List<WorkingHoursRange> replaceWeeklySchedule(UUID tenantId, UUID membershipId,
      List<WorkingHoursRange> ranges) {
    validate(ranges);
    repository.deleteAllForMembership(tenantId, membershipId);
    List<WorkingHours> entities = ranges.stream().map(range -> {
      WorkingHours hours = new WorkingHours();
      hours.setTenantId(tenantId);
      hours.setMembershipId(membershipId);
      hours.setDayOfWeek(range.dayOfWeek().shortValue());
      hours.setStartTime(range.startTime());
      hours.setEndTime(range.endTime());
      return hours;
    }).toList();
    repository.saveAll(entities);
    return sorted(ranges);
  }

  @Transactional(readOnly = true)
  public Map<UUID, List<WorkingHoursRange>> scheduleByMembership(UUID tenantId) {
    return repository.findAllByTenantIdOrderByDayOfWeekAscStartTimeAsc(tenantId).stream()
        .collect(Collectors.groupingBy(WorkingHours::getMembershipId,
            Collectors.mapping(WorkingHoursService::toRange, Collectors.toList())));
  }

  static void validate(List<WorkingHoursRange> ranges) {
    for (WorkingHoursRange range : ranges) {
      if (!range.startTime().isBefore(range.endTime())) {
        throw new BadRequestException("ranges", "startTime must be before endTime on day " + range.dayOfWeek());
      }
    }
    Map<Integer, List<WorkingHoursRange>> byDay = ranges.stream()
        .collect(Collectors.groupingBy(WorkingHoursRange::dayOfWeek));
    byDay.forEach((day, dayRanges) -> {
      List<WorkingHoursRange> ordered = sorted(dayRanges);
      for (int i = 1; i < ordered.size(); i++) {
        if (ordered.get(i).startTime().isBefore(ordered.get(i - 1).endTime())) {
          throw new BadRequestException("ranges", "Working ranges overlap on day " + day);
        }
      }
    });
  }

  private static List<WorkingHoursRange> sorted(List<WorkingHoursRange> ranges) {
    return ranges.stream()
        .sorted(Comparator.comparing(WorkingHoursRange::dayOfWeek).thenComparing(WorkingHoursRange::startTime))
        .toList();
  }

  private static WorkingHoursRange toRange(WorkingHours hours) {
    return new WorkingHoursRange((int) hours.getDayOfWeek(), hours.getStartTime(), hours.getEndTime());
  }
}
