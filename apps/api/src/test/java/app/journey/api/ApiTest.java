package app.journey.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Base for API tests: the whole application, a real database, emptied before each test. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"local", "test"})
public abstract class ApiTest {

  @Autowired protected MockMvc mvc;
  @Autowired protected JdbcClient jdbc;

  @BeforeEach
  void emptyDatabase() {
    jdbc.sql("truncate table profiles, local_users").update();
  }

  /** Signs in with the test code and returns "Bearer <token>". */
  protected String signIn(String email) throws Exception {
    String body =
        mvc.perform(
                post("/local-auth/token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"%s\",\"code\":\"123456\"}".formatted(email)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return "Bearer " + JsonPath.<String>read(body, "$.accessToken");
  }
}
