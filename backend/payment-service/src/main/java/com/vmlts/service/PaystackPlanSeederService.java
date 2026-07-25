package com.vmlts.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vmlts.entity.SubscriptionPlan;
import com.vmlts.repository.SubscriptionPlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Self-provisions the "VMLTS Premium Monthly" and "VMLTS Premium Yearly" Paystack plans in
 * GHS (cedis) — this account is Ghana-registered, so GHS is what it can actually create plans
 * in. Mirrors the DataSeederService idempotent-upsert pattern used for lessons. Runs once on
 * startup and then retries every 10 minutes for any plan still missing a plan_code, so a
 * transient failure resolves itself without requiring a restart.
 *
 * IMPORTANT: this makes a live call to api.paystack.co. Any failure is logged and
 * swallowed — it must never block application startup.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaystackPlanSeederService {

    private final SubscriptionPlanRepository planRepository;
    private final OkHttpClient http = new OkHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${paystack.secret.key}")
    private String paystackKey;

    private static final String PAYSTACK_BASE = "https://api.paystack.co";
    private static final String CURRENCY = "GHS";

    private record PlanDef(String type, String name, BigDecimal amountGhs, String interval) {}

    private static final PlanDef[] PLANS = {
            new PlanDef("MONTHLY", "VMLTS Premium Monthly", BigDecimal.valueOf(50), "monthly"),
            new PlanDef("YEARLY", "VMLTS Premium Yearly", BigDecimal.valueOf(480), "annually"),
    };

    @EventListener(ApplicationReadyEvent.class)
    public void seedPlans() {
        for (PlanDef def : PLANS) {
            try {
                seedOne(def);
            } catch (Exception e) {
                // A network-level failure (DNS, connection refused, TLS handshake, timeout)
                // throws here before any HTTP response exists. Without this, the plan row
                // would never get a lastError recorded and /subscribe would keep showing the
                // generic "not available yet" message forever instead of the real reason.
                log.error("Failed to provision Paystack plan {}: {}: {}",
                        def.type(), e.getClass().getSimpleName(), e.getMessage());
                persistFailure(def, e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
    }

    private void persistFailure(PlanDef def, String reason) {
        try {
            SubscriptionPlan plan = planRepository.findByPlanType(def.type()).orElseGet(SubscriptionPlan::new);
            plan.setPlanType(def.type());
            if (plan.getAmount() == null) plan.setAmount(def.amountGhs());
            if (plan.getInterval() == null) plan.setInterval(def.interval());
            plan.setLastError(reason);
            planRepository.save(plan);
        } catch (Exception saveError) {
            log.error("Could not even persist the failure reason for plan {}: {}", def.type(), saveError.getMessage());
        }
    }

    // Retries any not-yet-provisioned plan periodically so a transient failure resolves
    // itself without requiring a restart.
    @Scheduled(fixedDelay = 10 * 60 * 1000, initialDelay = 10 * 60 * 1000)
    public void retryUnprovisionedPlans() {
        seedPlans();
    }

    private void seedOne(PlanDef def) throws Exception {
        var existing = planRepository.findByPlanType(def.type());

        // Already provisioned at the current price — nothing to do.
        if (existing.isPresent() && existing.get().getPlanCode() != null
                && existing.get().getAmount() != null
                && existing.get().getAmount().compareTo(def.amountGhs()) == 0) {
            return;
        }

        // Placeholder row so a failure has somewhere to record its reason, even on the very
        // first attempt (before any plan_code exists).
        SubscriptionPlan plan = existing.orElseGet(SubscriptionPlan::new);
        plan.setPlanType(def.type());
        if (plan.getAmount() == null) plan.setAmount(def.amountGhs());
        if (plan.getInterval() == null) plan.setInterval(def.interval());

        int amountMinorUnits = def.amountGhs().multiply(BigDecimal.valueOf(100)).intValue();
        String body = mapper.writeValueAsString(Map.of(
                "name", def.name(),
                "amount", amountMinorUnits,
                "interval", def.interval(),
                "currency", CURRENCY
        ));

        boolean priceChanged = plan.getPlanCode() != null;
        if (priceChanged) {
            // Plan already exists on Paystack but the price here has changed — update it in
            // place (PUT /plan/{code}) rather than creating a duplicate plan.
            updateExistingPlan(def, plan, body);
        } else {
            createNewPlan(def, plan, body);
        }
    }

    private void updateExistingPlan(PlanDef def, SubscriptionPlan plan, String body) throws Exception {
        Request req = new Request.Builder()
                .url(PAYSTACK_BASE + "/plan/" + plan.getPlanCode())
                .put(RequestBody.create(body, MediaType.parse("application/json")))
                .header("Authorization", "Bearer " + paystackKey)
                .build();

        try (Response res = http.newCall(req).execute()) {
            String raw = res.body() != null ? res.body().string() : "";
            if (!res.isSuccessful()) {
                fail(def, plan, "Paystack rejected plan price update (" + res.code() + "): " + raw);
                return;
            }
            JsonNode json = mapper.readTree(raw);
            if (!json.path("status").asBoolean(false)) {
                fail(def, plan, "Paystack plan price update failed: " + json.path("message").asText());
                return;
            }
            plan.setAmount(def.amountGhs());
            plan.setInterval(def.interval());
            plan.setProvisionedCurrency(CURRENCY);
            plan.setLastError(null);
            planRepository.save(plan);
            log.info("Updated Paystack plan {} ({}) to GHS {}", def.type(), plan.getPlanCode(), def.amountGhs());
        }
    }

    private void createNewPlan(PlanDef def, SubscriptionPlan plan, String body) throws Exception {
        Request req = new Request.Builder()
                .url(PAYSTACK_BASE + "/plan")
                .post(RequestBody.create(body, MediaType.parse("application/json")))
                .header("Authorization", "Bearer " + paystackKey)
                .build();

        try (Response res = http.newCall(req).execute()) {
            if (res.body() == null) {
                fail(def, plan, "No response body when creating plan");
                return;
            }
            String raw = res.body().string();
            if (!res.isSuccessful()) {
                fail(def, plan, "Paystack rejected plan creation (" + res.code() + "): " + raw);
                return;
            }
            JsonNode json = mapper.readTree(raw);
            if (!json.path("status").asBoolean(false) || json.get("data") == null) {
                fail(def, plan, "Paystack plan creation failed: " + json.path("message").asText());
                return;
            }
            String planCode = json.get("data").path("plan_code").asText(null);
            if (planCode == null) {
                fail(def, plan, "Paystack response missing plan_code");
                return;
            }

            plan.setPlanCode(planCode);
            plan.setAmount(def.amountGhs());
            plan.setInterval(def.interval());
            plan.setProvisionedCurrency(CURRENCY);
            plan.setLastError(null);
            planRepository.save(plan);
            log.info("Provisioned Paystack plan {} -> {} (GHS {})", def.type(), planCode, def.amountGhs());
        }
    }

    private void fail(PlanDef def, SubscriptionPlan plan, String reason) {
        log.error("Paystack plan {} failed: {}", def.type(), reason);
        plan.setLastError(reason);
        planRepository.save(plan);
    }
}
