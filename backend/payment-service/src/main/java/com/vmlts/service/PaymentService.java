package com.vmlts.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vmlts.entity.Payment;
import com.vmlts.entity.SubscriptionPlan;
import com.vmlts.entity.User;
import com.vmlts.repository.PaymentRepository;
import com.vmlts.repository.SubscriptionPlanRepository;
import com.vmlts.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final OkHttpClient http = new OkHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${paystack.secret.key}")
    private String paystackKey;

    private static final String PAYSTACK_BASE = "https://api.paystack.co";
    private static final int PREMIUM_AMOUNT = 5000; // GHS 50 in pesewas — legacy one-off flow, kept for backward compatibility

    @Transactional
    public Map<String, Object> initializePayment(UUID userId) throws Exception {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.isPremium()) throw new RuntimeException("Already a premium user");

        String reference = "VMLTS_" + userId + "_" + System.currentTimeMillis();
        String body = mapper.writeValueAsString(Map.of(
                "email", user.getEmail(),
                "amount", PREMIUM_AMOUNT,
                "reference", reference,
                "currency", "GHS",
                "metadata", Map.of("userId", userId.toString())
        ));

        Request req = new Request.Builder()
                .url(PAYSTACK_BASE + "/transaction/initialize")
                .post(RequestBody.create(body, MediaType.parse("application/json")))
                .header("Authorization", "Bearer " + paystackKey)
                .build();

        try (Response res = http.newCall(req).execute()) {
            if (!res.isSuccessful() || res.body() == null) {
                throw new RuntimeException("Could not reach Paystack to start payment");
            }
            JsonNode json = mapper.readTree(res.body().string());
            if (!json.path("status").asBoolean(false) || json.get("data") == null) {
                throw new RuntimeException(json.path("message").asText("Payment initialization failed"));
            }
            JsonNode data = json.get("data");

            Payment payment = new Payment();
            payment.setUserId(userId);
            payment.setReference(reference);
            payment.setAmount(BigDecimal.valueOf(PREMIUM_AMOUNT / 100.0));
            payment.setStatus("pending");
            paymentRepository.save(payment);

            return Map.of(
                    "authorization_url", data.get("authorization_url").asText(),
                    "reference", reference,
                    "access_code", data.get("access_code").asText()
            );
        }
    }

    @Transactional
    public Map<String, Object> verifyPayment(UUID userId, String reference) throws Exception {
        Request req = new Request.Builder()
                .url(PAYSTACK_BASE + "/transaction/verify/" + reference)
                .header("Authorization", "Bearer " + paystackKey)
                .build();

        Payment payment = paymentRepository.findByReference(reference)
                .orElseThrow(() -> new RuntimeException("Payment reference not found"));

        // Critical: only the user who initiated this payment may verify/claim it. Without this
        // check, any authenticated user who obtained a valid successful reference (e.g. leaked via
        // a redirect URL or logs) could grant themselves premium without paying.
        if (!payment.getUserId().equals(userId)) {
            throw new RuntimeException("This payment reference does not belong to you");
        }

        if ("success".equals(payment.getStatus())) {
            // Already verified previously — return success without re-crediting anything.
            return Map.of("message", "Payment already verified.", "status", "success");
        }

        try (Response res = http.newCall(req).execute()) {
            if (!res.isSuccessful() || res.body() == null) {
                throw new RuntimeException("Could not reach Paystack to verify payment");
            }
            JsonNode root = mapper.readTree(res.body().string());
            if (!root.path("status").asBoolean(false) || root.get("data") == null) {
                throw new RuntimeException(root.path("message").asText("Payment verification failed"));
            }
            JsonNode data = root.get("data");

            if ("success".equals(data.get("status").asText())) {
                payment.setStatus("success");
                paymentRepository.save(payment);

                var user = userRepository.findById(userId).orElseThrow();
                user.setPremium(true);
                user.setBalance(BigDecimal.valueOf(10000));
                userRepository.save(user);
                return Map.of("message", "Payment verified. You are now a premium user!", "status", "success");
            } else {
                payment.setStatus("failed");
                paymentRepository.save(payment);
                return Map.of("message", "Payment not successful", "status", data.get("status").asText());
            }
        }
    }

    public List<Payment> getPaymentHistory(UUID userId) {
        return paymentRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ---- Subscription model (Free / Premium Monthly / Premium Yearly, GHS) ----

    public List<Map<String, Object>> getPlans() {
        return List.of(
                Map.of(
                        "id", "FREE",
                        "name", "Free",
                        "priceGhs", 0,
                        "interval", "forever",
                        "features", List.of("Basic lessons", "Limited simulator")
                ),
                Map.of(
                        "id", "MONTHLY",
                        "name", "Premium Monthly",
                        "priceGhs", 50,
                        "interval", "monthly",
                        "features", List.of("All lessons available", "Full News Coverage", "Access to multiple theme styles", "Access to advanced trade analytics")
                ),
                Map.of(
                        "id", "YEARLY",
                        "name", "Premium Yearly",
                        "priceGhs", 480,
                        "interval", "annually",
                        "features", List.of("All lessons available", "Full News Coverage", "Access to multiple theme styles", "Access to advanced trade analytics", "2 months free vs. monthly")
                )
        );
    }

    public Map<String, Object> getSubscriptionStatus(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("isPremium", user.isPremium());
        result.put("plan", user.getSubscriptionPlan());
        result.put("status", user.getSubscriptionStatus());
        result.put("currentPeriodEnd", user.getCurrentPeriodEnd());
        return result;
    }

    /**
     * Self-service cancellation from the app. Always downgrades the user locally regardless
     * of what happens on Paystack's side (so the app never gets stuck on a failed API call),
     * but first attempts to call Paystack's real "disable subscription" API using the
     * subscription_code + email_token captured from the subscription.create webhook. If those
     * aren't present (e.g. user never actually had a Paystack recurring plan), we skip the
     * remote call and just downgrade locally.
     */
    @Transactional
    public void cancelSubscription(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!user.isPremium()) throw new RuntimeException("You don't have an active subscription to cancel");

        String subCode = user.getPaystackSubscriptionCode();
        String emailToken = user.getPaystackEmailToken();
        if (subCode != null && emailToken != null) {
            try {
                Map<String, String> body = Map.of("code", subCode, "token", emailToken);
                Request req = new Request.Builder()
                        .url(PAYSTACK_BASE + "/subscription/disable")
                        .addHeader("Authorization", "Bearer " + paystackKey)
                        .addHeader("Content-Type", "application/json")
                        .post(RequestBody.create(mapper.writeValueAsString(body), MediaType.parse("application/json")))
                        .build();
                try (Response resp = http.newCall(req).execute()) {
                    if (resp.isSuccessful()) {
                        log.info("Paystack subscription {} disabled for user {}", subCode, user.getId());
                    } else {
                        log.warn("Paystack disable-subscription call failed for user {}: {} {}",
                                user.getId(), resp.code(), resp.body() != null ? resp.body().string() : "");
                    }
                }
            } catch (Exception e) {
                log.warn("Error calling Paystack disable-subscription for user {}: {}", user.getId(), e.getMessage());
            }
        } else {
            log.info("No Paystack subscription_code on file for user {} — downgrading locally only", user.getId());
        }

        user.setPremium(false);
        user.setSubscriptionStatus("cancelled");
        user.setSubscriptionPlan(null);
        user.setCurrentPeriodEnd(null);
        user.setBalance(BigDecimal.valueOf(1000));
        userRepository.save(user);
    }

    @Transactional
    public Map<String, Object> initializeSubscription(UUID userId, String planType) throws Exception {
        if (!"MONTHLY".equals(planType) && !"YEARLY".equals(planType)) {
            throw new RuntimeException("planType must be MONTHLY or YEARLY");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        SubscriptionPlan plan = subscriptionPlanRepository.findByPlanType(planType)
                .orElseThrow(() -> new RuntimeException("This plan is not available yet — please try again shortly"));
        if (plan.getPlanCode() == null) {
            // Surface the real Paystack rejection reason (recorded by PaystackPlanSeederService)
            // instead of a generic message, so this is debuggable from the app itself.
            String detail = plan.getLastError();
            throw new RuntimeException(detail != null
                    ? "This plan could not be set up: " + detail
                    : "This plan is not available yet — please try again shortly");
        }

        String reference = "VMLTS_SUB_" + userId + "_" + System.currentTimeMillis();
        int amountMinorUnits = plan.getAmount().multiply(BigDecimal.valueOf(100)).intValue();
        String body = mapper.writeValueAsString(Map.of(
                "email", user.getEmail(),
                "amount", amountMinorUnits,
                "plan", plan.getPlanCode(),
                "reference", reference,
                "channels", List.of("card", "mobile_money"),
                // Without this, Paystack shows its own hosted success page and never navigates
                // anywhere else, so the app's WebView never detects completion and never calls
                // /verify — the account silently never gets upgraded even though payment succeeded.
                "callback_url", "https://vmlts.app/vmlts-payment-callback",
                "metadata", Map.of("userId", userId.toString(), "planType", planType)
        ));

        Request req = new Request.Builder()
                .url(PAYSTACK_BASE + "/transaction/initialize")
                .post(RequestBody.create(body, MediaType.parse("application/json")))
                .header("Authorization", "Bearer " + paystackKey)
                .build();
try (Response res = http.newCall(req).execute()) {
    String rawBody = res.body() != null ? res.body().string() : null;
    if (!res.isSuccessful() || rawBody == null) {
        String reason = null;
        if (rawBody != null) {
            try { reason = mapper.readTree(rawBody).path("message").asText(null); } catch (Exception ignored) {}
        }
        log.error("Paystack /transaction/initialize failed: HTTP {} body={}", res.code(), rawBody);
        throw new RuntimeException(reason != null
                ? "Paystack rejected the request: " + reason
                : "Could not reach Paystack to start subscription (HTTP " + res.code() + ")");
    }
    JsonNode json = mapper.readTree(rawBody);
            if (!json.path("status").asBoolean(false) || json.get("data") == null) {
                throw new RuntimeException(json.path("message").asText("Subscription initialization failed"));
            }
            JsonNode data = json.get("data");

            Payment payment = new Payment();
            payment.setUserId(userId);
            payment.setReference(reference);
            payment.setAmount(plan.getAmount());
            payment.setStatus("pending");
            payment.setPlanType(planType);
            paymentRepository.save(payment);

            return Map.of(
                    "authorization_url", data.get("authorization_url").asText(),
                    "reference", reference,
                    "access_code", data.get("access_code").asText()
            );
        }
    }

    /**
     * Verifies the x-paystack-signature header (HMAC-SHA512 of the raw request body, keyed
     * with the Paystack secret key) before trusting any webhook payload. Always returns
     * normally (never throws) after signature verification passes, so PaymentController can
     * always ack with 200 — Paystack retries aggressively on non-2xx responses.
     */
    @Transactional
    public void handleWebhook(String rawBody, String signature) {
        if (signature == null || !verifySignature(rawBody, signature)) {
            log.error("Rejected webhook: invalid or missing x-paystack-signature");
            return;
        }

        JsonNode root;
        try {
            root = mapper.readTree(rawBody);
        } catch (Exception e) {
            log.error("Rejected webhook: unparseable JSON body");
            return;
        }

        String event = root.path("event").asText("");
        JsonNode data = root.path("data");

        try {
            switch (event) {
                case "charge.success" -> onChargeSuccess(data);
                case "subscription.create" -> onSubscriptionCreate(data);
                case "subscription.disable" -> onSubscriptionDisabled(data);
                case "invoice.payment_failed" -> onInvoiceFailed(data);
                default -> log.info("Ignoring unhandled Paystack webhook event: {}", event);
            }
        } catch (Exception e) {
            // Never let a malformed payload crash webhook processing — just log it.
            log.error("Error processing Paystack webhook event {}: {}", event, e.getMessage());
        }
    }

    private void onChargeSuccess(JsonNode data) {
        String reference = data.path("reference").asText(null);
        if (reference == null) return;

        Payment payment = paymentRepository.findByReference(reference).orElse(null);
        if (payment == null) {
            log.warn("charge.success for unknown reference {}", reference);
            return;
        }
        payment.setStatus("success");
        paymentRepository.save(payment);

        User user = userRepository.findById(payment.getUserId()).orElse(null);
        if (user == null) return;

        String planType = payment.getPlanType();
        user.setPremium(true);
        user.setSubscriptionStatus("active");
        if (planType != null) {
            user.setSubscriptionPlan(planType);
            user.setCurrentPeriodEnd("YEARLY".equals(planType)
                    ? Instant.now().plus(365, ChronoUnit.DAYS)
                    : Instant.now().plus(30, ChronoUnit.DAYS));
        }
        String customerCode = data.path("customer").path("customer_code").asText(null);
        if (customerCode != null) user.setPaystackCustomerCode(customerCode);
        // Note: this is the transaction's plan_code (which plan it billed), NOT the
        // subscription_code needed to disable the subscription later — those only arrive via
        // the separate subscription.create webhook, handled in onSubscriptionCreate below.
        userRepository.save(user);
        log.info("Activated subscription for user {} (plan {})", user.getId(), planType);
    }

    /**
     * Paystack sends this shortly after charge.success when the transaction included a
     * "plan" — this is the only place the subscription_code + email_token needed to later
     * call the disable-subscription API are ever provided. Matched to our user by email
     * since that's always present and unique, unlike this event's customer_code which may
     * not yet be stored if this webhook races ahead of charge.success.
     */
    private void onSubscriptionCreate(JsonNode data) {
        String subCode = data.path("subscription_code").asText(null);
        String emailToken = data.path("email_token").asText(null);
        String customerEmail = data.path("customer").path("email").asText(null);
        if (subCode == null || emailToken == null || customerEmail == null) {
            log.warn("subscription.create webhook missing required fields (subCode={}, emailToken={}, email={})",
                    subCode != null, emailToken != null, customerEmail != null);
            return;
        }
        userRepository.findByEmail(customerEmail).ifPresentOrElse(user -> {
            user.setPaystackSubscriptionCode(subCode);
            user.setPaystackEmailToken(emailToken);
            userRepository.save(user);
            log.info("Captured Paystack subscription code for user {}", user.getId());
        }, () -> log.warn("subscription.create webhook for unknown user email"));
    }

    private void onSubscriptionDisabled(JsonNode data) {
        String subCode = data.path("subscription_code").asText(null);
        if (subCode == null) return;
        userRepository.findAll().stream()
                .filter(u -> subCode.equals(u.getPaystackSubscriptionCode()))
                .findFirst()
                .ifPresent(u -> {
                    u.setSubscriptionStatus("cancelled");
                    userRepository.save(u);
                    log.info("Marked subscription cancelled for user {}", u.getId());
                });
    }

    private void onInvoiceFailed(JsonNode data) {
        String subCode = data.path("subscription").path("subscription_code").asText(null);
        if (subCode == null) return;
        userRepository.findAll().stream()
                .filter(u -> subCode.equals(u.getPaystackSubscriptionCode()))
                .findFirst()
                .ifPresent(u -> {
                    u.setSubscriptionStatus("past_due");
                    userRepository.save(u);
                    log.info("Marked subscription past_due for user {}", u.getId());
                });
    }

    private boolean verifySignature(String rawBody, String signature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(paystackKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] hash = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            String computed = HexFormat.of().formatHex(hash);
            return MessageDigest.isEqual(
                    computed.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            log.error("Signature verification error: {}", e.getMessage());
            return false;
        }
    }
}
