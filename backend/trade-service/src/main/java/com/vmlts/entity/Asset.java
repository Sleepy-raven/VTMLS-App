package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Replaces the old hardcoded ASSETS array in MarketSimulatorService — moving it into the
 * database lets an admin toggle assets active/inactive at runtime (Market Control screen)
 * without a redeploy. `active` is what actually removes an asset from prices/trading; the
 * simulator still keeps its base price and pip size here so re-activating one just resumes
 * from wherever it left off.
 */
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
