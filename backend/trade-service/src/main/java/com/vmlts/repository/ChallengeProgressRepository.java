package com.vmlts.repository;

import com.vmlts.entity.ChallengeProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChallengeProgressRepository extends JpaRepository<ChallengeProgress, Long> {
    List<ChallengeProgress> findByUserId(UUID userId);
    Optional<ChallengeProgress> findByUserIdAndChallengeId(UUID userId, Long challengeId);
}
