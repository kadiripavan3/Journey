package app.journey.api;

import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

/** What two settings switch on and off: the reviewers' password, and the app's ids in the stores. */
@TestPropertySource(
        properties = {
            "journey.admin.password=",
            "journey.links.ios-app-id=ABCDE12345.app.journey",
            "journey.links.android-package=app.journey",
            "journey.links.android-fingerprints=14:6D:E9:83:C5:73, AB:CD:EF:01:23:45"
        })
class ConfiguredPagesTest extends ApiTest {

    @Test
    void withoutAReviewersPasswordTheReviewerPagesDoNotExist() throws Exception {
        mvc.perform(get("/admin")).andExpect(status().isNotFound());
        mvc.perform(get("/admin").with(httpBasic("ada", ""))).andExpect(status().isNotFound());
        mvc.perform(get("/admin").with(httpBasic("ada", "review"))).andExpect(status().isNotFound());
        mvc.perform(post("/admin/photos/" + UUID.randomUUID() + "/remove")
                        .with(httpBasic("ada", "review"))
                        .with(csrf()))
                .andExpect(status().isNotFound());
        // A signed-in person of the app is nobody here either.
        mvc.perform(get("/admin").header("Authorization", person("maya"))).andExpect(status().isNotFound());
    }

    @Test
    void theFilesThatLetALinkOpenTheAppAreBuiltFromTheAppsIds() throws Exception {
        mvc.perform(get("/.well-known/apple-app-site-association"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.applinks.details[0].appIDs", contains("ABCDE12345.app.journey")))
                .andExpect(
                        jsonPath("$.applinks.details[0].components[*]['/']", contains("/j/*", "/e/*", "/u/*", "/i/*")));
        mvc.perform(get("/.well-known/assetlinks.json"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].relation", contains("delegate_permission/common.handle_all_urls")))
                .andExpect(jsonPath("$[0].target.namespace").value("android_app"))
                .andExpect(jsonPath("$[0].target.package_name").value("app.journey"))
                .andExpect(jsonPath(
                        "$[0].target.sha256_cert_fingerprints", contains("14:6D:E9:83:C5:73", "AB:CD:EF:01:23:45")));
    }
}
