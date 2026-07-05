package com.vmlts.repository;

import com.vmlts.entity.LessonProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, Long> {
    List<LessonProgress> findByUserId(UUID userId);
    Optional<LessonProgress> findByUserIdAndLessonId(UUID userId, Long lessonId);
}
