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

    // "MONTHLY" | "YEARLY" | null (never subscribed / free tier)
    @Column(name = "subscription_plan")
    private String subscriptionPlan;

    // "active" | "past_due" | "cancelled" | null
    @Column(name = "subscription_status")
    private String subscriptionStatus;

    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    @Column(name = "paystack_customer_code")
    private String paystackCustomerCode;

    @Column(name = "paystack_subscription_code")
    private String paystackSubscriptionCode;

    // Required alongside paystackSubscriptionCode to call Paystack's disable-subscription
    // API. Populated from the subscription.create webhook, not available at charge time.
    @Column(name = "paystack_email_token")
    private String paystackEmailToken;

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
