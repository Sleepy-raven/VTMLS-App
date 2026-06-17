package com.vmlts.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.vmlts.entity.enums.Role;
import com.vmlts.entity.enums.Tier;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tier tier;

    @Column(nullable = false)
    @JsonProperty("isPremium")
    private boolean isPremium;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal balance;

    @Column(name = "reset_code")
    private String resetCode;

    @Column(name = "reset_code_expiry")
    private Instant resetCodeExpiry;

    // Confirms the person registering actually controls the email address they signed up
    // with. Defaults to true (not false!) so this migration doesn't retroactively lock out
    // every account that already existed before this feature — register() is the only place
    // that explicitly sets this false, for brand-new signups only.
    @Column(name = "email_verified", nullable = false, columnDefinition = "boolean default true")
    private boolean emailVerified;

    @Column(name = "verification_code")
    private String verificationCode;

    @Column(name = "verification_code_expiry")
    private Instant verificationCodeExpiry;

    // "MONTHLY" | "YEARLY" | null (never subscribed / free tier)
    @Column(name = "subscription_plan")
    private String subscriptionPlan;

    // "active" | "past_due" | "cancelled" | null
    @Column(name = "subscription_status")
    private String subscriptionStatus;

    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    // Expo push token for this user's most recently active device. Nullable — set once the
    // app registers for push notifications and grants permission.
    @Column(name = "push_token")
    private String pushToken;

    // Base64-encoded profile photo, resized/compressed client-side before upload. TEXT (not
    // a fixed-length varchar) since a compressed small photo can still run to tens of KB.
    @Column(name = "profile_photo", columnDefinition = "TEXT")
    private String profilePhoto;

    // Account-deletion request flow: the learner requests deletion in-app, confirms via an
    // emailed code (same pattern as forgot-password), and the request is then just a flag an
    // admin sees and acts on manually — this doesn't delete anything by itself.
    @Column(name = "deletion_code")
    private String deletionCode;

    @Column(name = "deletion_code_expiry")
    private Instant deletionCodeExpiry;

    @Column(name = "deletion_requested", nullable = false, columnDefinition = "boolean default false")
    private boolean deletionRequested;

    @Column(name = "deletion_requested_at")
    private Instant deletionRequestedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (role == null) role = Role.LEARNER;
        if (tier == null) tier = Tier.BEGINNER;
        if (balance == null) balance = BigDecimal.valueOf(1000);
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
