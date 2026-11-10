package app.journey.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Likes, comments, following people, and the Activity inbox that reports them. */
class SocialTest extends ApiTest {

  @Test
  void anEntryCanBeLikedOnceAndUnliked() throws Exception {
    String maya = person("maya");
    String nora = person("nora");
    String entry = entry(maya, journey(maya, "Trip", "public", 3), "Hoi An", 0);

    mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.likeCount").value(1))
        .andExpect(jsonPath("$.viewer.hasLiked").value(true));
    mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora)).andExpect(jsonPath("$.likeCount").value(1));
    mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
        .andExpect(jsonPath("$.likeCount").value(1))
        .andExpect(jsonPath("$.viewer.hasLiked").value(false));
    mvc.perform(delete("/v1/entries/" + entry + "/like").header("Authorization", nora))
        .andExpect(jsonPath("$.likeCount").value(0))
        .andExpect(jsonPath("$.viewer.hasLiked").value(false));
  }

  @Test
  void nobodyCanLikeOrCommentOnWhatTheyCannotSee() throws Exception {
    String maya = person("maya");
    String nora = person("nora");
    String entry = entry(maya, journey(maya, "Diary", "private", 3), "Just for me", 0);

    mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora)).andExpect(status().isNotFound());
    mvc.perform(comment(nora, entry, "Hello?", null)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", nora)).andExpect(status().isNotFound());
  }

  @Test
  void commentsHaveOneLevelOfRepliesAndTheCreatorIsMarked() throws Exception {
    String maya = person("maya");
    String nora = person("nora");
    String kai = person("kai");
    String entry = entry(maya, journey(maya, "Trip", "public", 3), "Mount Bromo", 0);

    String first = id(mvc.perform(comment(nora, entry, "  Was it freezing?  ", null))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.body").value("Was it freezing?"))
        .andExpect(jsonPath("$.byCreator").value(false)));
    String reply = id(mvc.perform(comment(maya, entry, "Two jumpers and still shaking.", first))
        .andExpect(jsonPath("$.parentId").value(first))
        .andExpect(jsonPath("$.byCreator").value(true)));
    // A reply to a reply joins the same thread.
    mvc.perform(comment(kai, entry, "Worth it though?", reply)).andExpect(jsonPath("$.parentId").value(first));

    mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", kai))
        .andExpect(jsonPath("$", hasSize(3)))
        .andExpect(jsonPath("$[0].body").value("Was it freezing?"))
        .andExpect(jsonPath("$[0].viewer.canDelete").value(false))
        .andExpect(jsonPath("$[2].viewer.canDelete").value(true));
    mvc.perform(get("/v1/entries/" + entry).header("Authorization", kai)).andExpect(jsonPath("$.commentCount").value(3));

    mvc.perform(comment(nora, entry, "   ", null))
        .andExpect(status().isBadRequest());
    mvc.perform(comment(nora, entry, "x".repeat(501), null))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.body").value("Keep comments to 500 characters or fewer."));
  }

  @Test
  void aCommentIsDeletedByItsAuthorOrTheCreatorAndTakesItsRepliesAlong() throws Exception {
    String maya = person("maya");
    String nora = person("nora");
    String kai = person("kai");
    String entry = entry(maya, journey(maya, "Trip", "public", 3), "Mount Bromo", 0);
    String first = id(mvc.perform(comment(nora, entry, "First", null)));
    id(mvc.perform(comment(kai, entry, "A reply", first)));
    String other = id(mvc.perform(comment(kai, entry, "Another", null)));

    mvc.perform(delete("/v1/comments/" + first).header("Authorization", kai))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("not_yours"));
    mvc.perform(delete("/v1/comments/" + first).header("Authorization", maya)).andExpect(status().isNoContent());
    mvc.perform(delete("/v1/comments/" + other).header("Authorization", kai)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", nora)).andExpect(jsonPath("$", hasSize(0)));
    mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora)).andExpect(jsonPath("$.commentCount").value(0));
  }

  @Test
  void followingAPersonShowsOnBothProfilesAndBringsTheirNextPublicJourney() throws Exception {
    String maya = person("maya");
    String nora = person("nora");
    journey(maya, "Before", "public", 9);
    journey(maya, "Diary", "private", 9);

    mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.followerCount").value(1))
        .andExpect(jsonPath("$.journeyCount").value(1))
        .andExpect(jsonPath("$.viewer.isFollowing").value(true))
        .andExpect(jsonPath("$.viewer.isMe").value(false));
    mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", nora))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("thats_you"));
    mvc.perform(get("/v1/profiles/maya").header("Authorization", maya))
        .andExpect(jsonPath("$.journeyCount").value(2))
        .andExpect(jsonPath("$.viewer.isMe").value(true));
    mvc.perform(get("/v1/profiles/nora").header("Authorization", maya))
        .andExpect(jsonPath("$.followingCount").value(1))
        .andExpect(jsonPath("$.viewer.followsYou").value(true));
    mvc.perform(get("/v1/profiles/maya/followers").header("Authorization", maya))
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].username").value("nora"))
        .andExpect(jsonPath("$[0].viewer.isFollowing").value(false));
    mvc.perform(get("/v1/profiles/nora/following").header("Authorization", nora))
        .andExpect(jsonPath("$[0].username").value("maya"))
        .andExpect(jsonPath("$[0].latestJourney").value("Before"));

    // Journeys that existed before are not followed; the next public one is, and a private one never.
    mvc.perform(get("/v1/me/following").header("Authorization", nora)).andExpect(jsonPath("$", hasSize(0)));
    String next = journey(maya, "After", "public", 0);
    journey(maya, "Secret", "private", 0);
    mvc.perform(get("/v1/me/following").header("Authorization", nora))
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].id").value(next))
        .andExpect(jsonPath("$[0].followerCount").value(1));

    mvc.perform(delete("/v1/profiles/maya/follow").header("Authorization", nora)).andExpect(jsonPath("$.followerCount").value(0));
    mvc.perform(get("/v1/profiles/nobody").header("Authorization", nora))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("profile_not_found"));
  }

  @Test
  void activityGathersWhatHappenedAndKnowsWhatIsNew() throws Exception {
    String nora = person("nora");
    String maya = person("maya");
    String kai = person("kai");
    String mine = journey(nora, "Iceland ring road", "public", 5);
    String myEntry = entry(nora, mine, "Skogafoss", 1);
    String theirs = journey(maya, "Southeast Asia", "public", 9);

    mvc.perform(get("/v1/activity").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items", hasSize(0)))
        .andExpect(jsonPath("$.newCount").value(0));

    mvc.perform(put("/v1/journeys/" + theirs + "/follow").header("Authorization", nora)).andExpect(status().isOk());
    entry(maya, theirs, "Hoi An", 1);
    entry(maya, theirs, "Mount Bromo", 0);
    mvc.perform(put("/v1/entries/" + myEntry + "/like").header("Authorization", maya)).andExpect(status().isOk());
    mvc.perform(put("/v1/entries/" + myEntry + "/like").header("Authorization", kai)).andExpect(status().isOk());
    String mineComment = id(mvc.perform(comment(nora, myEntry, "Day one!", null)));
    mvc.perform(comment(kai, myEntry, "That rainbow!", mineComment)).andExpect(status().isCreated());
    mvc.perform(put("/v1/journeys/" + mine + "/follow").header("Authorization", kai)).andExpect(status().isOk());
    mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", kai)).andExpect(status().isOk());

    String inbox = mvc.perform(get("/v1/activity").header("Authorization", nora))
        .andExpect(jsonPath("$.items", hasSize(5)))
        .andExpect(jsonPath("$.newCount").value(5))
        .andReturn().getResponse().getContentAsString();
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<String>>read(inbox, "$.items[*].kind"))
        .containsExactlyInAnyOrder("new_entries", "likes", "reply", "journey_follow", "profile_follow");
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<Integer>>read(inbox, "$.items[?(@.kind=='new_entries')].count")).containsExactly(2);
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<String>>read(inbox, "$.items[?(@.kind=='new_entries')].journeyTitle"))
        .containsExactly("Southeast Asia");
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<Integer>>read(inbox, "$.items[?(@.kind=='likes')].actorCount")).containsExactly(2);
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<String>>read(inbox, "$.items[?(@.kind=='likes')].actors[0].username")).containsExactly("kai");
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<String>>read(inbox, "$.items[?(@.kind=='reply')].text")).containsExactly("That rainbow!");
    org.assertj.core.api.Assertions.assertThat(JsonPath.<java.util.List<Boolean>>read(inbox, "$.items[?(@.kind=='profile_follow')].followsActor")).containsExactly(false);

    // What you do yourself never shows up in your own Activity.
    mvc.perform(get("/v1/activity").header("Authorization", kai)).andExpect(jsonPath("$.items", hasSize(0)));

    mvc.perform(post("/v1/activity/seen").header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/activity").header("Authorization", nora))
        .andExpect(jsonPath("$.items", hasSize(5)))
        .andExpect(jsonPath("$.newCount").value(0));
  }

  private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder comment(String token, String entryId, String body, String parentId) {
    String parent = parentId == null ? "null" : "\"" + parentId + "\"";
    return post("/v1/entries/" + entryId + "/comments")
        .header("Authorization", token)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"body\":\"%s\",\"parentId\":%s}".formatted(body, parent));
  }

  private static String id(org.springframework.test.web.servlet.ResultActions result) throws Exception {
    return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
  }
}
