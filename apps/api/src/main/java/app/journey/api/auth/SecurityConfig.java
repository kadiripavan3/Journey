package app.journey.api.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Who may call what. Everything under /v1 needs a valid sign-in token; the API keeps no sessions.
 */
@Configuration
class SecurityConfig {

  static final String LOCAL_ISSUER = "journey-local";
  static final String AUDIENCE = "authenticated";

  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            requests ->
                requests
                    .requestMatchers("/actuator/health/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers("/local-auth/**", "/local-media/**", "/media/**")
                    .permitAll() // these controllers only exist in local mode; uploads carry their own token
                    .requestMatchers("/v1/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .oauth2ResourceServer(server -> server.jwt(Customizer.withDefaults()));
    return http.build();
  }

  /** Browsers (the web preview) need CORS. Phones don't, so the list is empty outside local mode. */
  @Bean
  CorsConfigurationSource corsConfigurationSource(
      @Value("${journey.cors.allowed-origin-patterns:}") String allowedOriginPatterns) {
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    List<String> patterns =
        Arrays.stream(allowedOriginPatterns.split(",")).map(String::trim).filter(p -> !p.isEmpty()).toList();
    if (!patterns.isEmpty()) {
      CorsConfiguration cors = new CorsConfiguration();
      cors.setAllowedOriginPatterns(patterns);
      cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
      cors.setAllowedHeaders(List.of("*"));
      cors.setMaxAge(3600L);
      source.registerCorsConfiguration("/**", cors);
    }
    return source;
  }

  @Bean
  JwtDecoder jwtDecoder(AuthProperties auth) {
    if (!auth.isLocal()) {
      throw new IllegalStateException(
          "journey.auth.mode is '" + auth.mode() + "'. Only 'local' exists so far: run with the 'local' profile. "
              + "Supabase sign-in is connected in a later step.");
    }
    NimbusJwtDecoder decoder =
        NimbusJwtDecoder.withSecretKey(localKey(auth)).macAlgorithm(MacAlgorithm.HS256).build();
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<Jwt>(
            JwtValidators.createDefaultWithIssuer(LOCAL_ISSUER),
            new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(AUDIENCE))));
    return decoder;
  }

  @Bean
  @ConditionalOnProperty(name = "journey.auth.mode", havingValue = "local")
  JwtEncoder localJwtEncoder(AuthProperties auth) {
    return new NimbusJwtEncoder(new ImmutableSecret<>(localKey(auth)));
  }

  private static SecretKey localKey(AuthProperties auth) {
    byte[] secret = auth.local().secret().getBytes(StandardCharsets.UTF_8);
    if (secret.length < 32) {
      throw new IllegalStateException("journey.auth.local.secret must be at least 32 characters.");
    }
    return new SecretKeySpec(secret, "HmacSHA256");
  }
}
