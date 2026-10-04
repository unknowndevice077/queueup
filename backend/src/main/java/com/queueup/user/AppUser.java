package com.queueup.user;

import com.queueup.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "app_user")
public class AppUser extends BaseEntity {

  @Column(nullable = false, unique = true, length = 254)
  private String email;

  @Column(name = "password_hash", nullable = false, length = 100)
  private String passwordHash;

  @Column(name = "full_name", nullable = false, length = 120)
  private String fullName;

  @Column(length = 32)
  private String phone;

  @Column(name = "email_verified", nullable = false)
  private boolean emailVerified;

  @Column(nullable = false)
  private boolean enabled = true;
}
