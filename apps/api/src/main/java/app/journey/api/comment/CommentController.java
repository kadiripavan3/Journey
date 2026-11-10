package app.journey.api.comment;

import app.journey.api.auth.Me;
import app.journey.api.comment.CommentService.CommentResponse;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Comments")
class CommentController {

    record AddCommentRequest(
            @NotBlank(message = "Write something first.")
            @Size(max = 500, message = "Keep comments to 500 characters or fewer.")
            String body,

            @Schema(description = "The comment being replied to, if any")
            UUID parentId,

            @Schema(
                    description =
                            "An id the app makes up for this comment. Sending it again gives back the comment it made the first time.")
            UUID clientId) {}

    private final CommentService comments;

    CommentController(CommentService comments) {
        this.comments = comments;
    }

    @GetMapping("/entries/{entryId}/comments")
    @Operation(operationId = "getComments", summary = "An entry's comments, oldest first")
    Page<CommentResponse> list(
            @Me UUID me,
            @PathVariable UUID entryId,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return comments.list(entryId, me, PageRequest.of(cursor, limit, 50));
    }

    @PostMapping("/entries/{entryId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "addComment", summary = "Comment on an entry, or reply to a comment")
    CommentResponse add(@Me UUID me, @PathVariable UUID entryId, @Valid @RequestBody AddCommentRequest request) {
        return comments.add(entryId, me, request.body(), request.parentId(), request.clientId());
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteComment", summary = "Delete a comment and its replies")
    void delete(@Me UUID me, @PathVariable UUID id) {
        comments.delete(id, me);
    }
}
