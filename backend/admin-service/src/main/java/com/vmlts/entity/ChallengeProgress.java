package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

// Read/write mirror of trade-service's ChallengeProgress entity, mapped to the same shared
// "challenge_progress" table, so admin-service can list and mark payouts without cross-service calls.
@Entity
@Table(name = "challenge_progress")
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

    @Column(nullable = false)
    private boolean paid;

    private Instant paidAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;
}
