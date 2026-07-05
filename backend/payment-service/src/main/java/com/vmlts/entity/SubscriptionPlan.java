package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

// Stores the Paystack plan_code we get back after provisioning MONTHLY/YEARLY
// plans on their side, so we don't try to recreate them on every restart.
@Entity
@Table(name = "subscription_plans")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // "MONTHLY" | "YEARLY"
    @Column(nullable = false, unique = true)
    private String planType;

    @Column(name = "plan_code")
    private String planCode;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    // paystack interval value: "monthly" | "annually"
    @Column(nullable = false)
    private String interval;

    // Currency this plan was provisioned in on Paystack's side — GHS (cedis), matching this
    // merchant account. See PaystackPlanSeederService.
    @Column(name = "provisioned_currency")
    private String provisionedCurrency;

    // The actual reason the last provisioning/update attempt failed (e.g. Paystack's own
    // rejection message), so failures are visible from the app/API instead of only in logs.
    // Cleared to null on a successful provision/update.
    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;
}
