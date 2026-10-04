package com.queueup.user;

import com.queueup.user.dto.UserResponse;
import org.mapstruct.Mapper;

@Mapper
public interface UserMapper {

  UserResponse toResponse(AppUser user);
}
