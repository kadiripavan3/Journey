package app.journey.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class ProfileTest extends ApiTest {

    private ResultActions saveProfile(String token, String json) throws Exception {
        return mvc.perform(put("/v1/me/profile")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                // Being 13 or older is confirmed in every one of these; ModerationTest covers leaving it out.
                .content(json.replaceFirst("\\{", "{\"ageConfirmed\":true,")));
    }

    private static final String NORA = """
      {"displayName":" Nora Lind ","username":"@Nora.Lind","bio":"Photographer. Slow travel and long walks.",
       "link":"noralind.photo","interests":["Travel","Hiking","Travel"," "]}
      """;

    @Test
    void aNewPersonCreatesTheirProfile() throws Exception {
        String token = signIn("nora@example.com");

        saveProfile(token, NORA)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("nora.lind"))
                .andExpect(jsonPath("$.displayName").value("Nora Lind"))
                .andExpect(jsonPath("$.interests.length()").value(2));

        mvc.perform(get("/v1/me").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.username").value("nora.lind"))
                .andExpect(jsonPath("$.profile.bio").value("Photographer. Slow travel and long walks."))
                .andExpect(jsonPath("$.profile.link").value("noralind.photo"));
    }

    @Test
    void savingAgainChangesTheProfileAndKeepsTheUsername() throws Exception {
        String token = signIn("nora@example.com");
        saveProfile(token, NORA).andExpect(status().isOk());

        saveProfile(token, "{\"displayName\":\"Nora L.\",\"username\":\"nora.lind\",\"bio\":\"\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nora L."))
                .andExpect(jsonPath("$.bio").value(""))
                // Interests weren't sent, so they stay; an empty list clears them.
                .andExpect(jsonPath("$.interests.length()").value(2));
        saveProfile(token, "{\"displayName\":\"Nora L.\",\"username\":\"nora.lind\",\"interests\":[]}")
                .andExpect(jsonPath("$.interests.length()").value(0));
    }

    @Test
    void twoPeopleCannotHaveTheSameUsername() throws Exception {
        saveProfile(signIn("nora@example.com"), NORA).andExpect(status().isOk());

        saveProfile(signIn("other@example.com"), "{\"displayName\":\"Other Nora\",\"username\":\"NORA.LIND\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("username_taken"));
    }

    @Test
    void usernamesFollowTheRules() throws Exception {
        String token = signIn("nora@example.com");

        saveProfile(token, "{\"displayName\":\"Nora\",\"username\":\"no\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_username"))
                .andExpect(jsonPath("$.detail").value("Use at least 3 characters."));
        saveProfile(token, "{\"displayName\":\"Nora\",\"username\":\"nora lind!\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Use only letters, numbers, dots and underscores."));
        saveProfile(token, "{\"displayName\":\"Nora\",\"username\":\"admin\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("That name is reserved. Try another."));
    }

    @Test
    void missingDetailsAreNamedFieldByField() throws Exception {
        saveProfile(signIn("nora@example.com"), "{\"displayName\":\"\",\"username\":\"nora.lind\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_input"))
                .andExpect(jsonPath("$.fields.displayName").value("Add your name."));
    }

    @Test
    void theAppCanCheckAUsernameWhileThePersonTypes() throws Exception {
        String nora = signIn("nora@example.com");
        saveProfile(nora, NORA).andExpect(status().isOk());
        String other = signIn("other@example.com");

        mvc.perform(get("/v1/usernames/@Nora.Lind").header("Authorization", other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("nora.lind"))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.reason").value("That name is taken. Try another."));
        mvc.perform(get("/v1/usernames/alex.strand").header("Authorization", other))
                .andExpect(jsonPath("$.available").value(true));
        // Your own username is yours to keep.
        mvc.perform(get("/v1/usernames/nora.lind").header("Authorization", nora))
                .andExpect(jsonPath("$.available").value(true));
    }
}
