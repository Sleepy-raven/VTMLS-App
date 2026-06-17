package com.vmlts.entity;

import jakarta.persistence.*;
import lombok.*;

// Mirror of trade-service's MarketSettings entity, mapped to the same shared
// `market_settings` table (single row, id=1).
@Entity
@Table(name = "market_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MarketSettings {

    @Id
    private Long id;

    @Column(name = "tick_interval_ms", nullable = false)
    private int tickIntervalMs;
}
