package com.queueup.catalog;

import com.queueup.catalog.dto.ServiceResponse;
import org.mapstruct.Mapper;

@Mapper
public interface ServiceMapper {

  ServiceResponse toResponse(ServiceOffering service);
}
