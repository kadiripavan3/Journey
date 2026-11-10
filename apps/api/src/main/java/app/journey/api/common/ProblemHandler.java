package app.journey.api.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Turns every failure into the same JSON shape (RFC 9457 "problem details") with two extras the app
 * relies on: {@code code}, and for invalid input {@code fields} (field name to message).
 */
@RestControllerAdvice
public class ProblemHandler extends ResponseEntityExceptionHandler {

  @ExceptionHandler(ApiProblem.class)
  ResponseEntity<ProblemDetail> handle(ApiProblem problem) {
    ProblemDetail body = ProblemDetail.forStatusAndDetail(problem.status(), problem.getMessage());
    body.setProperty("code", problem.code());
    return ResponseEntity.status(problem.status()).body(body);
  }

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    Map<String, String> fields = new LinkedHashMap<>();
    ex.getBindingResult()
        .getFieldErrors()
        .forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
    ProblemDetail body =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Some details need another look.");
    body.setProperty("code", "invalid_input");
    body.setProperty("fields", fields);
    return ResponseEntity.badRequest().body(body);
  }
}
