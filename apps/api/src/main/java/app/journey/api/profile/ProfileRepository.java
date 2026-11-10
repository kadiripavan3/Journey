package app.journey.api.profile;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ProfileRepository extends JpaRepository<Profile, UUID> {

  boolean existsByUsernameAndIdNot(String username, UUID id);

  boolean existsByUsername(String username);
}
