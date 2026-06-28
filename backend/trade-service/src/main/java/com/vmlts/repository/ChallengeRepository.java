package com.vmlts.repository;

import com.vmlts.entity.Challenge;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    Optional<Challenge> findByTitle(String title);
    boolean existsByTitle(String title);
}
