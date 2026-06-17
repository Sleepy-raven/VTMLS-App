package com.vmlts.repository;

import com.vmlts.entity.ChallengeProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChallengeProgressRepository extends JpaRepository<ChallengeProgress, Long> {
    List<ChallengeProgress> findByCompletedTrueOrderByCompletedAtDesc();
}
