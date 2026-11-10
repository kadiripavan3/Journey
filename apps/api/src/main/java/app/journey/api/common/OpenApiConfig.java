package app.journey.api.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** The API's description. The app's TypeScript client is generated from it. */
@Configuration
class OpenApiConfig {

  @Bean
  OpenAPI journeyOpenApi() {
    return new OpenAPI()
        .info(new Info().title("Journey API").version("v1").description("Backend of the Journey app."))
        .components(
            new Components()
                .addSecuritySchemes(
                    "bearer", new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
        .addSecurityItem(new SecurityRequirement().addList("bearer"));
  }

  /**
   * In everything the API sends back, a field is always present unless it is declared nullable. Saying
   * so in the description gives the app exact types instead of "maybe undefined" everywhere.
   */
  @Bean
  OpenApiCustomizer responseFieldsAreRequired() {
    return openApi -> {
      if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
        return;
      }
      openApi.getComponents().getSchemas().forEach((name, schema) -> {
        if (name.endsWith("Response") && schema.getProperties() != null) {
          @SuppressWarnings("unchecked")
          Map<String, Schema<?>> properties = (Map<String, Schema<?>>) (Map<String, ?>) schema.getProperties();
          List<String> required = new ArrayList<>(properties.keySet());
          schema.setRequired(required);
          properties.replaceAll((property, value) -> nullableReference(value));
        }
      });
    };
  }

  /**
   * "Another object, or null" must be written as a choice between the two. Left alone, the generator
   * writes it in a way that reads as "always null".
   */
  private static Schema<?> nullableReference(Schema<?> property) {
    boolean nullable = property.getTypes() != null && property.getTypes().contains("null");
    if (property.get$ref() == null || !nullable) {
      return property;
    }
    Schema<Object> reference = new Schema<>();
    reference.set$ref(property.get$ref());
    Schema<Object> nothing = new Schema<>();
    nothing.addType("null");
    Schema<Object> choice = new Schema<>();
    choice.setDescription(property.getDescription());
    choice.setOneOf(List.of(reference, nothing));
    return choice;
  }
}
