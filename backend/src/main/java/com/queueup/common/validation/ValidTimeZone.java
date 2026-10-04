package com.queueup.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** A valid IANA time zone id such as Asia/Manila. Null is allowed (use @NotNull to forbid). */
@Documented
@Constraint(validatedBy = ValidTimeZoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidTimeZone {

  String message() default "must be a valid IANA time zone, e.g. Asia/Manila";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
