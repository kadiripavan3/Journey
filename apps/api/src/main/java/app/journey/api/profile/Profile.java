package app.journey.api.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A person's public profile. Its id is the id of the signed-in user. */
@Entity
@Table(name = "profiles")
public class Profile {

  @Id private UUID id;

  @Column(nullable = false)
  private String username;

  @Column(nullable = false)
  private String displayName;

  @Column(nullable = false)
  private String bio = "";

  private String link;

  private String avatarPath;

  @JdbcTypeCode(SqlTypes.ARRAY)
  @Column(nullable = false, columnDefinition = "text[]")
  private String[] interests = new String[0];

  @Column(nullable = false, updatable = false)
  private Instant createdAt = Instant.now();

  @Column(nullable = false)
  private Instant updatedAt = Instant.now();

  protected Profile() {}

  public Profile(UUID id) {
    this.id = id;
  }

  public void update(String username, String displayName, String bio, String link, String[] interests) {
    this.username = username;
    this.displayName = displayName;
    this.bio = bio;
    this.link = link;
    this.interests = interests;
    this.updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getUsername() {
    return username;
  }

  public String getDisplayName() {
    return displayName;
  }

  public String getBio() {
    return bio;
  }

  public String getLink() {
    return link;
  }

  public String getAvatarPath() {
    return avatarPath;
  }

  public String[] getInterests() {
    return interests;
  }
}
