package com.vmlts.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "lessons")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Lesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String title;

    @Column(nullable = false)
    private String duration;

    // Explicit @JsonProperty is required here: Lombok keeps the getter as isPremium() (it
    // doesn't double the "is" prefix), but Jackson's default bean-naming convention then
    // strips that same "is" prefix again when deriving the JSON key, producing "premium"
    // instead of "isPremium". Since the frontend reads lesson.isPremium (not .premium), that
    // mismatch made every premium lesson silently evaluate as free. This pins the JSON key.
    @Column(nullable = false)
    @JsonProperty("isPremium")
    private boolean isPremium;

    // "order" is a reserved SQL keyword — stored as lesson_order
    @Column(name = "lesson_order", nullable = false)
    private int order;

    @Column(columnDefinition = "TEXT")
    private String content;

    // 11-character YouTube video ID (e.g. "dQw4w9WgXcQ"), embedded via youtube.com/embed/{videoId}
    @Column(name = "video_id")
    private String videoId;

    // JSON array of quiz questions: [{"q":"...","options":["a","b","c","d"],"correct":0}, ...]
    @Column(name = "quiz_json", columnDefinition = "TEXT")
    private String quizJson;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
