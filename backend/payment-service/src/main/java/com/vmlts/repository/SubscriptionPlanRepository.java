package com.vmlts.repository;

import com.vmlts.entity.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {
    Optional<SubscriptionPlan> findByPlanType(String planType);
}
