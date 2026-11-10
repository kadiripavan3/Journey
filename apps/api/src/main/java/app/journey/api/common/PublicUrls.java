package app.journey.api.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * The address people reach the API at, for links that leave the app (a shared journey's web page).
 * Set {@code journey.public-url} wherever the API runs behind a proxy or sends links from a scheduled job;
 * without it, the address is taken from the request, which is right on a laptop and a phone on the same Wi-Fi.
 */
@Component
public class PublicUrls {

  private final String base;

  PublicUrls(@Value("${journey.public-url:}") String base) {
    this.base = base == null ? "" : base.trim().replaceAll("/+$", "");
  }

  /** The full address for a path that starts with a slash. */
  public String to(String path) {
    if (!base.isEmpty()) {
      return base + path;
    }
    if (RequestContextHolder.getRequestAttributes() == null) {
      return path; // a job with no request and no configured address: a relative link is the honest answer
    }
    return ServletUriComponentsBuilder.fromCurrentContextPath().path(path).toUriString();
  }
}
