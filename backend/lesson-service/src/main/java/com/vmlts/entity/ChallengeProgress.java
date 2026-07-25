package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "challenge_progress",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "challenge_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChallengeProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private Long challengeId;

    @Column(nullable = false)
    private int current;

    @Column(nullable = false)
    private boolean completed;

    private Instant completedAt;

    // Whether the cash prize has been paid out (claimed by the user, or force-marked by an
    // admin). columnDefinition supplies a DEFAULT so this can be added to an already-populated
    // table — mirrors the same column already added on trade-service/admin-service's entities.
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean paid;

    private Instant paidAt;

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
