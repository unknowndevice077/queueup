package com.queueup.tenant;

import com.queueup.tenant.dto.TenantSettingsResponse;
import com.queueup.tenant.dto.UpdateSettingsRequest;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.BeanMapping;

@Mapper
public interface TenantMapper {

  TenantSettingsResponse toSettings(Tenant tenant);

  @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
  void applySettings(UpdateSettingsRequest request, @MappingTarget Tenant tenant);
}
