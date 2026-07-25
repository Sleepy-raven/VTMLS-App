package com.vmlts.controller;

import com.vmlts.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/initialize")
    public ResponseEntity<?> initialize(Authentication auth) {
        try {
            return ResponseEntity.ok(paymentService.initializePayment(UUID.fromString(auth.getName())));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Payment initialization failed"));
        }
    }

    @GetMapping("/verify/{reference}")
    public ResponseEntity<?> verify(@PathVariable String reference, Authentication auth) {
        try {
            return ResponseEntity.ok(paymentService.verifyPayment(UUID.fromString(auth.getName()), reference));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Payment verification failed"));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> history(Authentication auth) {
        return ResponseEntity.ok(
                Map.of("payments", paymentService.getPaymentHistory(UUID.fromString(auth.getName()))));
    }

    @GetMapping("/plans")
    public ResponseEntity<?> plans() {
        return ResponseEntity.ok(Map.of("plans", paymentService.getPlans()));
    }

    @GetMapping("/subscription")
    public ResponseEntity<?> subscription(Authentication auth) {
        return ResponseEntity.ok(paymentService.getSubscriptionStatus(UUID.fromString(auth.getName())));
    }

    @PostMapping("/subscription/cancel")
    public ResponseEntity<?> cancelSubscription(Authentication auth) {
        try {
            paymentService.cancelSubscription(UUID.fromString(auth.getName()));
            return ResponseEntity.ok(Map.of("message", "Subscription cancelled"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@RequestBody Map<String, String> body, Authentication auth) {
        try {
            String planType = body.get("planType");
            return ResponseEntity.ok(paymentService.initializeSubscription(UUID.fromString(auth.getName()), planType));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Subscription initialization failed"));
        }
    }

    // Paystack calls this directly (no JWT) — must stay permitAll in SecurityConfig.
    // Always ack 200 so Paystack doesn't endlessly retry; verification/errors are logged internally.
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestBody String rawBody,
                                      @RequestHeader(value = "x-paystack-signature", required = false) String signature) {
        paymentService.handleWebhook(rawBody, signature);
        return ResponseEntity.ok().build();
    }
}
