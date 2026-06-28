package com.vmlts.repository;

import com.vmlts.entity.Trade;
import com.vmlts.entity.enums.TradeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {
    List<Trade> findByUserId(UUID userId);
    List<Trade> findByUserIdAndStatusOrderByOpenedAtDesc(UUID userId, TradeStatus status);
    List<Trade> findByUserIdAndStatusOrderByClosedAtDesc(UUID userId, TradeStatus status);
    List<Trade> findByUserIdOrderByOpenedAtDesc(UUID userId);
    List<Trade> findByStatus(TradeStatus status);
}
