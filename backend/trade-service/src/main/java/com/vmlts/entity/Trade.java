package com.vmlts.entity;

import com.vmlts.entity.enums.TradeStatus;
import com.vmlts.entity.enums.TradeType;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "trades")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Trade {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TradeType type;

    @Column(nullable = false)
    private double lotSize;

    @Column(nullable = false)
    private double entryPrice;

    private Double exitPrice;
    private Double stopLoss;
    private Double takeProfit;
    private Double pnl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TradeStatus status;

    private Double tradeScore;

    @Column(length = 1)
    private String scoreGrade;

    private Double entryScore;
    private Double slScore;
    private Double rrScore;
    private Double exitScore;

    @Column(length = 500)
    private String scoreFeedback;

    @Column(nullable = false, updatable = false)
    private Instant openedAt;

    private Instant closedAt;

    @PrePersist
    protected void onCreate() {
        openedAt = Instant.now();
        if (status == null) status = TradeStatus.OPEN;
    }
}
