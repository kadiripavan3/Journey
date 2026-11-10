package app.journey.api.profile;

import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes profiles. */
@Repository
public class ProfileStore {

    private final JdbcClient jdbc;

    ProfileStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Profile> find(UUID id) {
        return jdbc.sql(
                        "select p.id, p.username, p.display_name, p.bio, p.link, p.avatar_media_id, a.storage_key as avatar_key,"
                                + " p.interests from profiles p"
                                + Rules.chosenPhoto("a", "p.avatar_media_id")
                                + " where p.id = :id")
                .param("id", id)
                .query((rs, n) -> new Profile(
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("bio"),
                        rs.getString("link"),
                        rs.getObject("avatar_media_id", UUID.class),
                        rs.getString("avatar_key"),
                        Sql.strings(rs, "interests")))
                .optional();
    }

    public boolean exists(UUID id) {
        return jdbc.sql("select exists (select 1 from profiles where id = :id)")
                .param("id", id)
                .query(Boolean.class)
                .single();
    }

    /** True when someone else already has this username. */
    public boolean usernameTaken(String username, UUID exceptId) {
        return jdbc.sql(
                        "select exists (select 1 from profiles where username = :username and (cast(:except as uuid) is null or id <> cast(:except as uuid)))")
                .param("username", username)
                .param("except", exceptId == null ? null : exceptId.toString())
                .query(Boolean.class)
                .single();
    }

    /** Records that the person said they are 13 or older, the moment a new profile is made. Kept once; never changed. */
    public void confirmAge(UUID id) {
        jdbc.sql("update profiles set age_confirmed_at = now() where id = :id and age_confirmed_at is null")
                .param("id", id)
                .update();
    }

    /** Creates the profile the first time and changes it after that. The database's unique rule on usernames has the last word. */
    public void save(
            UUID id,
            String username,
            String displayName,
            String bio,
            String link,
            List<String> interests,
            UUID avatarMediaId) {
        jdbc.sql("""
            insert into profiles (id, username, display_name, bio, link, interests, avatar_media_id)
            values (:id, :username, :name, :bio, :link, :interests, :avatar)
            on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, bio = excluded.bio,
              link = excluded.link, interests = excluded.interests, avatar_media_id = excluded.avatar_media_id, updated_at = now()
            """)
                .param("id", id)
                .param("username", username)
                .param("name", displayName)
                .param("bio", bio)
                .param("link", link)
                .param("interests", interests.toArray(String[]::new))
                .param("avatar", avatarMediaId)
                .update();
    }
}
