package com.vmlts.repository;

import com.vmlts.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    Optional<Lesson> findByTitle(String title);

    @Query("SELECT l FROM Lesson l ORDER BY l.order ASC")
    List<Lesson> findAllOrdered();
}
