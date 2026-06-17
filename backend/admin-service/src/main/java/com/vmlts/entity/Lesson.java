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

    @Column(nullable = false)
    @JsonProperty("isPremium")
    private boolean isPremium;

    // "order" is a reserved SQL keyword — stored as lesson_order
    @Column(name = "lesson_order", nullable = false)
    private int order;

    @Column(columnDefinition = "TEXT")
    private String content;

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
