package app.journey.api.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/catalog")
@Tag(name = "catalog", description = "The fixed lists the app offers")
class CatalogController {

    record CategoryResponse(String id, String label, String emoji) {}

    record InterestResponse(String id, String label, String emoji, String category) {}

    record TemplateResponse(
            String id,
            String name,
            String emoji,
            String description,
            String defaultCategory,
            String labelStyle,
            @Schema(nullable = true) Integer targetDays,
            List<String> prompts) {}

    record CatalogResponse(
            List<CategoryResponse> categories, List<InterestResponse> interests, List<TemplateResponse> templates) {}

    @GetMapping
    @Operation(operationId = "getCatalog", summary = "Interests, categories and journey templates")
    CatalogResponse catalog() {
        return new CatalogResponse(
                Catalog.CATEGORIES.stream()
                        .map(c -> new CategoryResponse(c.id(), c.label(), c.emoji()))
                        .toList(),
                Catalog.INTERESTS.stream()
                        .map(i -> new InterestResponse(i.id(), i.label(), i.emoji(), i.category()))
                        .toList(),
                Catalog.TEMPLATES.stream()
                        .map(t -> new TemplateResponse(
                                t.id(),
                                t.name(),
                                t.emoji(),
                                t.description(),
                                t.defaultCategory(),
                                t.labelStyle(),
                                t.targetDays(),
                                t.prompts()))
                        .toList());
    }
}
