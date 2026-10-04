package com.queueup.common.web;

import com.queueup.common.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.sql.SQLException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Maps every exception to the RFC 7807 {@link ApiError} format. Never leaks stack traces. */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
  private static final String EXCLUSION_VIOLATION = "23P01";

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ApiError> handleApi(ApiException ex, HttpServletRequest request) {
    List<ApiError.FieldError> errors = ex.getViolations().stream()
        .map(v -> new ApiError.FieldError(v.field(), v.message()))
        .toList();
    return respond(ex.getStatus(), ex.getTitle(), ex.getMessage(), request, errors);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> handleBodyValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
    List<ApiError.FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
        .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
        .toList();
    List<ApiError.FieldError> globalErrors = ex.getBindingResult().getGlobalErrors().stream()
        .map(ge -> new ApiError.FieldError(ge.getObjectName(), ge.getDefaultMessage()))
        .toList();
    return validationFailed(request, concat(errors, globalErrors));
  }

  @ExceptionHandler(HandlerMethodValidationException.class)
  public ResponseEntity<ApiError> handleMethodValidation(HandlerMethodValidationException ex,
      HttpServletRequest request) {
    List<ApiError.FieldError> errors = ex.getParameterValidationResults().stream()
        .flatMap(result -> result.getResolvableErrors().stream()
            .map(error -> new ApiError.FieldError(
                result.getMethodParameter().getParameterName(), error.getDefaultMessage())))
        .toList();
    return validationFailed(request, errors);
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex,
      HttpServletRequest request) {
    List<ApiError.FieldError> errors = ex.getConstraintViolations().stream()
        .map(v -> new ApiError.FieldError(lastPathNode(v.getPropertyPath().toString()), v.getMessage()))
        .toList();
    return validationFailed(request, errors);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
    return respond(HttpStatus.BAD_REQUEST, "Malformed request", "Request body is missing or malformed", request,
        List.of());
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
      HttpServletRequest request) {
    String message = "Invalid value for parameter '" + ex.getName() + "'";
    return validationFailed(request, List.of(new ApiError.FieldError(ex.getName(), message)));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiError> handleMissingParam(MissingServletRequestParameterException ex,
      HttpServletRequest request) {
    return validationFailed(request,
        List.of(new ApiError.FieldError(ex.getParameterName(), "Parameter is required")));
  }

  @ExceptionHandler(MissingRequestHeaderException.class)
  public ResponseEntity<ApiError> handleMissingHeader(MissingRequestHeaderException ex, HttpServletRequest request) {
    return respond(HttpStatus.BAD_REQUEST, "Bad Request", "Missing header " + ex.getHeaderName(), request,
        List.of());
  }

  @ExceptionHandler(PropertyReferenceException.class)
  public ResponseEntity<ApiError> handleBadSort(PropertyReferenceException ex, HttpServletRequest request) {
    return validationFailed(request,
        List.of(new ApiError.FieldError("sort", "Unknown sort property '" + ex.getPropertyName() + "'")));
  }

  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  public ResponseEntity<ApiError> handleOptimisticLock(ObjectOptimisticLockingFailureException ex,
      HttpServletRequest request) {
    return respond(HttpStatus.CONFLICT, "Conflict",
        "The resource was modified by someone else. Reload and try again.", request, List.of());
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiError> handleIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
    if (EXCLUSION_VIOLATION.equals(sqlState(ex))) {
      return respond(HttpStatus.CONFLICT, "Conflict", "Slot no longer available", request, List.of());
    }
    log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
    return respond(HttpStatus.CONFLICT, "Conflict", "The request conflicts with existing data", request, List.of());
  }

  @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
  public ResponseEntity<ApiError> handleAccessDenied(RuntimeException ex, HttpServletRequest request) {
    return respond(HttpStatus.FORBIDDEN, "Forbidden", "You do not have permission to perform this action", request,
        List.of());
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex, HttpServletRequest request) {
    return respond(HttpStatus.UNAUTHORIZED, "Unauthorized", "Authentication is required", request, List.of());
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex, HttpServletRequest request) {
    return respond(HttpStatus.NOT_FOUND, "Not Found", "Resource not found", request, List.of());
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ApiError> handleMethod(HttpRequestMethodNotSupportedException ex,
      HttpServletRequest request) {
    return respond(HttpStatus.METHOD_NOT_ALLOWED, "Method Not Allowed", ex.getMessage(), request, List.of());
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ApiError> handleMediaType(HttpMediaTypeNotSupportedException ex,
      HttpServletRequest request) {
    return respond(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported Media Type", ex.getMessage(), request,
        List.of());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
    log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), ex);
    return respond(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
        "An unexpected error occurred. Quote the traceId when contacting support.", request, List.of());
  }

  private ResponseEntity<ApiError> validationFailed(HttpServletRequest request, List<ApiError.FieldError> errors) {
    return respond(HttpStatus.BAD_REQUEST, "Validation failed", "One or more fields are invalid", request, errors);
  }

  private ResponseEntity<ApiError> respond(HttpStatus status, String title, String detail,
      HttpServletRequest request, List<ApiError.FieldError> errors) {
    return ResponseEntity.status(status)
        .contentType(MediaType.APPLICATION_PROBLEM_JSON)
        .body(ProblemFactory.create(status, title, detail, request, errors));
  }

  private static String sqlState(Throwable ex) {
    Throwable current = ex;
    while (current != null) {
      if (current instanceof SQLException sqlException) {
        return sqlException.getSQLState();
      }
      current = current.getCause();
    }
    return null;
  }

  private static String lastPathNode(String path) {
    int dot = path.lastIndexOf('.');
    return dot >= 0 ? path.substring(dot + 1) : path;
  }

  private static <T> List<T> concat(List<T> first, List<T> second) {
    return java.util.stream.Stream.concat(first.stream(), second.stream()).toList();
  }
}
