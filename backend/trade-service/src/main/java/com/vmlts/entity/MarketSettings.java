package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Single-row table (id is always 1) holding admin-controlled market simulator settings.
 * Currently just the price-tick interval, but structured to grow if more global simulator
 * controls are added later.
 */
@Entity
@Table(name = "market_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MarketSettings {

    @Id
    private Long id;

    @Column(name = "tick_interval_ms", nullable = false)
    private int tickIntervalMs;
}
