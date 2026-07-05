package com.vmlts.repository;

import com.vmlts.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByReference(String reference);
    List<Payment> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
