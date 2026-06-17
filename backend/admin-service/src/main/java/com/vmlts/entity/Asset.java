package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;

// Mirror of trade-service's Asset entity, mapped to the same shared `assets` table — this is
// how the admin Market Control screen reads/toggles assets that trade-service's price
// simulator actually runs off of.
@Entity
@Table(name = "assets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Asset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String symbol;

    @Column(name = "base_price", nullable = false)
    private double basePrice;

    @Column(nullable = false)
    private double pip;

    @Column(name = "premium_only", nullable = false)
    private boolean premiumOnly;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active;
}
