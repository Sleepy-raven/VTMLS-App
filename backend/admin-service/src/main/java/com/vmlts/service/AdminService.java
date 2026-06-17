package com.vmlts.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vmlts.dto.AdminChallengeRequest;
import com.vmlts.dto.AdminLessonRequest;
import com.vmlts.dto.AdminUserUpdateRequest;
import com.vmlts.entity.Challenge;
import com.vmlts.entity.Lesson;
import com.vmlts.entity.MarketSettings;
import com.vmlts.entity.enums.Tier;
import com.vmlts.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private final UserRepository userRepository;
    private final TradeRepository tradeRepository;
    private final LessonRepository lessonRepository;
    private final ChallengeRepository challengeRepository;
    private final PaymentRepository paymentRepository;
    private final ChallengeProgressRepository challengeProgressRepository;
    private final AssetRepository assetRepository;
    private final MarketSettingsRepository marketSettingsRepository;

    // 250ms floor keeps the simulator from being set so fast it hammers the DB/socket
    // broadcast; 10s ceiling keeps it from feeling frozen.
    private static final int MIN_TICK_INTERVAL_MS = 250;
    private static final int MAX_TICK_INTERVAL_MS = 10_000;

    public List<Map<String, Object>> getMarketAssets() {
        return assetRepository.findAllByOrderBySymbolAsc().stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("symbol", a.getSymbol());
            m.put("basePrice", a.getBasePrice());
            m.put("pip", a.getPip());
            m.put("premiumOnly", a.isPremiumOnly());
            m.put("active", a.isActive());
            return m;
        }).toList();
    }

    @Transactional
    public void setAssetActive(Long assetId, boolean active) {
        var asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        asset.setActive(active);
        assetRepository.save(asset);
    }

    public Map<String, Object> getMarketSettings() {
        var settings = marketSettingsRepository.findById(1L)
                .orElseThrow(() -> new RuntimeException("Market settings not initialized"));
        return Map.of("tickIntervalMs", settings.getTickIntervalMs());
    }

    @Transactional
    public Map<String, Object> updateMarketSettings(Integer tickIntervalMs) {
        if (tickIntervalMs == null)
            throw new RuntimeException("tickIntervalMs is required");
        if (tickIntervalMs < MIN_TICK_INTERVAL_MS || tickIntervalMs > MAX_TICK_INTERVAL_MS)
            throw new RuntimeException("tickIntervalMs must be between " + MIN_TICK_INTERVAL_MS + " and " + MAX_TICK_INTERVAL_MS);

        var settings = marketSettingsRepository.findById(1L)
                .orElseGet(() -> MarketSettings.builder().id(1L).build());
        settings.setTickIntervalMs(tickIntervalMs);
        marketSettingsRepository.save(settings);
        return Map.of("tickIntervalMs", tickIntervalMs);
    }

    public Map<String, Object> getDashboardStats() {
        long totalUsers      = userRepository.count();
        long premiumUsers    = userRepository.countByIsPremiumTrue();
        long freeUsers       = totalUsers - premiumUsers;
        long totalTrades     = tradeRepository.count();
        long totalLessons    = lessonRepository.count();
        long totalChallenges = challengeRepository.count();
        BigDecimal totalRevenue = paymentRepository.sumSuccessfulRevenue();

        var recent = userRepository.findAll().stream()
                .sorted(Comparator.comparing(u -> u.getCreatedAt(), Comparator.reverseOrder()))
                .limit(5)
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("email", u.getEmail());
                    m.put("role", u.getRole().name().toLowerCase());
                    m.put("tier", u.getTier().name().toLowerCase());
                    m.put("isPremium", u.isPremium());
                    m.put("createdAt", u.getCreatedAt());
                    return m;
                }).toList();

        return Map.of(
                "totalUsers", totalUsers,
                "premiumUsers", premiumUsers,
                "freeUsers", freeUsers,
                "totalTrades", totalTrades,
                "totalLessons", totalLessons,
                "totalChallenges", totalChallenges,
                "totalRevenue", totalRevenue,
                "recentUsers", recent
        );
    }

    public List<Map<String, Object>> getAllUsers() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(u -> u.getCreatedAt(), Comparator.reverseOrder()))
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("email", u.getEmail());
                    m.put("role", u.getRole().name().toLowerCase());
                    m.put("isPremium", u.isPremium());
                    m.put("tier", u.getTier().name().toLowerCase());
                    m.put("balance", u.getBalance());
                    m.put("createdAt", u.getCreatedAt());
                    m.put("deletionRequested", u.isDeletionRequested());
                    m.put("deletionRequestedAt", u.getDeletionRequestedAt());
                    return m;
                }).toList();
    }

    @Transactional
    public Map<String, Object> updateUser(UUID userId, AdminUserUpdateRequest req) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (req.getTier() != null) user.setTier(Tier.valueOf(req.getTier().toUpperCase()));
        if (req.getIsPremium() != null) {
            user.setPremium(req.getIsPremium());
            user.setBalance(req.getIsPremium() ? BigDecimal.valueOf(10000) : BigDecimal.valueOf(1000));
            if (req.getIsPremium()) {
                user.setSubscriptionStatus("active");
            } else {
                // Admin manually revoking premium — same end-state as a self-service cancellation.
                user.setSubscriptionStatus("cancelled");
                user.setSubscriptionPlan(null);
                user.setCurrentPeriodEnd(null);
            }
        }
        userRepository.save(user);
        return Map.of("message", "User updated");
    }

    @Transactional
    public void deleteUser(UUID userId) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() == com.vmlts.entity.enums.Role.ADMIN)
            throw new RuntimeException("Cannot delete an admin account from here");
        userRepository.deleteById(userId);
    }

    public List<Lesson> getAllLessons() {
        return lessonRepository.findAllOrdered();
    }

    @Transactional
    public void deleteLesson(Long id) {
        if (!lessonRepository.existsById(id)) throw new RuntimeException("Lesson not found");
        lessonRepository.deleteById(id);
    }

    public List<Challenge> getAllChallenges() {
        return challengeRepository.findAll();
    }

    @Transactional
    public void deleteChallenge(Long id) {
        if (!challengeRepository.existsById(id)) throw new RuntimeException("Challenge not found");
        challengeRepository.deleteById(id);
    }

    @Transactional
    public Lesson createLesson(AdminLessonRequest req) {
        if (req.getTitle() == null || req.getContent() == null || req.getDuration() == null)
            throw new RuntimeException("All fields are required");
        Lesson l = new Lesson();
        l.setTitle(req.getTitle());
        l.setContent(req.getContent());
        l.setDuration(req.getDuration());
        l.setPremium(req.isPremium());
        l.setOrder(req.getOrder());
        return lessonRepository.save(l);
    }

    public List<Map<String, Object>> getPayouts() {
        var completed = challengeProgressRepository.findByCompletedTrueOrderByCompletedAtDesc();
        var usersById = userRepository.findAll().stream()
                .collect(HashMap<UUID, com.vmlts.entity.User>::new, (m, u) -> m.put(u.getId(), u), HashMap::putAll);
        var challengesById = challengeRepository.findAll().stream()
                .collect(HashMap<Long, Challenge>::new, (m, c) -> m.put(c.getId(), c), HashMap::putAll);

        return completed.stream().map(p -> {
            var u = usersById.get(p.getUserId());
            var c = challengesById.get(p.getChallengeId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("userId", p.getUserId());
            m.put("userName", u != null ? u.getName() : "Unknown user");
            m.put("userEmail", u != null ? u.getEmail() : "");
            m.put("challengeTitle", c != null ? c.getTitle() : "Unknown challenge");
            m.put("cashPrize", c != null ? c.getCashPrize() : null);
            m.put("completedAt", p.getCompletedAt());
            m.put("paid", p.isPaid());
            m.put("paidAt", p.getPaidAt());
            return m;
        }).toList();
    }

    // Normally the user claims their own prize in-app (TradeService.claimChallenge), which
    // already flips this same `paid` flag — this admin action is just a manual fallback (e.g.
    // the user never claims it) that does the same credit-and-flip. The `paid` guard means
    // whichever path fires first "wins" and the other becomes a no-op, so there's no risk of
    // double-crediting no matter which side acts.
    @Transactional
    public void markPayoutPaid(Long progressId) {
        var p = challengeProgressRepository.findById(progressId)
                .orElseThrow(() -> new RuntimeException("Payout record not found"));
        if (!p.isCompleted()) throw new RuntimeException("Challenge is not completed yet");
        if (p.isPaid()) return;

        var challenge = challengeRepository.findById(p.getChallengeId()).orElse(null);
        BigDecimal prize = parseCashPrize(challenge != null ? challenge.getCashPrize() : null);
        if (prize.compareTo(BigDecimal.ZERO) > 0) {
            var user = userRepository.findById(p.getUserId()).orElse(null);
            if (user != null) {
                user.setBalance(user.getBalance().add(prize));
                userRepository.save(user);
            }
        }

        p.setPaid(true);
        p.setPaidAt(java.time.Instant.now());
        challengeProgressRepository.save(p);
    }

    private BigDecimal parseCashPrize(String cashPrize) {
        if (cashPrize == null || cashPrize.isBlank()) return BigDecimal.ZERO;
        String digits = cashPrize.replaceAll("[^0-9.]", "");
        if (digits.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(digits);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    /**
     * Sends a real push notification via Expo's push service to every registered device
     * matching the given audience. Requires the app to have registered a push token for the
     * user first (see AuthService.registerPushToken) — users who never granted notification
     * permission simply have no token and are skipped.
     */
    public Map<String, Object> sendNotification(String title, String body, String audience) {
        if (title == null || title.isBlank() || body == null || body.isBlank())
            throw new RuntimeException("Title and body are required");

        var tokens = userRepository.findAll().stream()
                .filter(u -> u.getPushToken() != null && !u.getPushToken().isBlank())
                .filter(u -> switch (audience == null ? "all" : audience) {
                    case "premium" -> u.isPremium();
                    case "free" -> !u.isPremium();
                    default -> true;
                })
                .map(u -> u.getPushToken())
                .distinct()
                .toList();

        if (tokens.isEmpty()) {
            return Map.of("sent", 0, "message", "No users with a registered device to notify");
        }

        int sent = 0;
        List<String> errors = new ArrayList<>();
        // Expo's push API accepts up to 100 messages per request.
        for (List<String> batch : partition(tokens, 100)) {
            try {
                var messages = batch.stream()
                        .map(t -> Map.of("to", t, "title", title, "body", body, "sound", "default"))
                        .collect(Collectors.toList());
                String json = mapper.writeValueAsString(messages);
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(EXPO_PUSH_URL))
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build();
                HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() >= 200 && res.statusCode() < 300) {
                    sent += batch.size();
                } else {
                    log.error("Expo push send failed: HTTP {} body={}", res.statusCode(), res.body());
                    errors.add("HTTP " + res.statusCode());
                }
            } catch (Exception e) {
                log.error("Expo push send failed", e);
                errors.add(e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sent", sent);
        result.put("total", tokens.size());
        if (!errors.isEmpty()) result.put("errors", errors);
        return result;
    }

    private static List<List<String>> partition(List<String> list, int size) {
        List<List<String>> out = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) out.add(list.subList(i, Math.min(i + size, list.size())));
        return out;
    }

    @Transactional
    public Challenge createChallenge(AdminChallengeRequest req) {
        if (req.getTitle() == null || req.getReward() == null || req.getTotal() <= 0)
            throw new RuntimeException("Title, reward and total are required");
        Challenge c = new Challenge();
        c.setTitle(req.getTitle());
        c.setReward(req.getReward());
        c.setCashPrize(req.getCashPrize());
        c.setPremium(req.isPremium());
        c.setTotal(req.getTotal());
        return challengeRepository.save(c);
    }
}
