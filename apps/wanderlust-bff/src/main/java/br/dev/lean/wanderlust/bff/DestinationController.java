package br.dev.lean.wanderlust.bff;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Pure pass-through — all aggregation/caching lives in catalog. */
@RestController
class DestinationController {

  private final CatalogClient catalog;

  DestinationController(CatalogClient catalog) {
    this.catalog = catalog;
  }

  @GetMapping("/destinations")
  List<Destination> list() {
    return catalog.list();
  }

  @GetMapping("/destinations/{id}")
  Destination get(@PathVariable String id) {
    return catalog.find(id).orElseThrow(() -> new DestinationNotFoundException(id));
  }

  @ExceptionHandler(DestinationNotFoundException.class)
  ProblemDetail handleNotFound(DestinationNotFoundException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
  }

  @ExceptionHandler(UpstreamUnavailableException.class)
  ProblemDetail handleUpstreamUnavailable(UpstreamUnavailableException ex) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, ex.getMessage());
  }
}
