package br.dev.lean.wanderlust.catalog;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class DestinationController {

  private final DestinationService service;

  DestinationController(DestinationService service) {
    this.service = service;
  }

  @GetMapping("/destinations")
  List<Destination> list() {
    return service.list();
  }

  @GetMapping("/destinations/{id}")
  Destination get(@PathVariable String id) {
    return service.find(id).orElseThrow(() -> new DestinationNotFoundException(id));
  }

  @ExceptionHandler(DestinationNotFoundException.class)
  ProblemDetail handleNotFound(DestinationNotFoundException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
  }
}
