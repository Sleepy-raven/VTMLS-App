package com.vmlts.service;

import com.corundumstudio.socketio.SocketIOServer;
import com.vmlts.entity.Asset;
import com.vmlts.entity.MarketSettings;
import com.vmlts.repository.AssetRepository;
import com.vmlts.repository.MarketSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Previously drove itself off a hardcoded ASSETS array and a fixed @Scheduled(1000ms)
 * annotation. Both are now admin-controllable (Market Control screen) via the assets and
 * market_settings tables. Since a @Scheduled interval can't be changed at runtime, this uses
 * a fast heartbeat that only fires an actual price tick once the admin-configured interval
 * has elapsed — settings/active-assets are cached and refreshed every few seconds rather than
 * queried on every heartbeat, since this runs many times a second.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketSimulatorService {

    private final SocketIOServer socketServer;
    private final AssetRepository assetRepository;
    private final MarketSettingsRepository marketSettingsRepository;

    private final Map<String, Double> prices = new LinkedHashMap<>();
    private volatile List<Asset> activeAssets = new ArrayList<>();
    private volatile int tickIntervalMs = 1000;
    private volatile long lastTickAt = 0;

    private double sessionMultiplier() {
        int hour = Calendar.getInstance(TimeZone.getTimeZone("UTC")).get(Calendar.HOUR_OF_DAY);
        if (hour >= 8 && hour < 17) return 1.5;
        if (hour >= 13 && hour < 22) return 1.3;
        if (hour >= 0 && hour < 9)  return 1.1;
        return 0.7;
    }

    // Refreshes the cached active-asset list and tick interval from the DB every 2 seconds —
    // this is what makes an admin's toggle/interval change take effect without a restart.
    // Newly-activated assets get seeded into `prices` at their base price; deactivated ones
    // are dropped from `prices` entirely so they stop showing up in quotes/trading.
    @Scheduled(fixedDelay = 2000)
    public void refreshSettings() {
        try {
            List<Asset> current = assetRepository.findByActiveTrue();
            for (Asset a : current) {
                prices.putIfAbsent(a.getSymbol(), a.getBasePrice());
            }
            Set<String> activeSymbols = new HashSet<>();
            for (Asset a : current) activeSymbols.add(a.getSymbol());
            prices.keySet().removeIf(symbol -> !activeSymbols.contains(symbol));
            activeAssets = current;

            marketSettingsRepository.findById(1L).ifPresent(s -> tickIntervalMs = Math.max(200, s.getTickIntervalMs()));
        } catch (Exception e) {
            log.warn("Could not refresh market settings: {}", e.getMessage());
        }
    }

    // Fast heartbeat — only performs an actual price tick once tickIntervalMs has elapsed
    // since the last one, which is how the interval stays admin-adjustable at runtime.
    @Scheduled(fixedDelay = 100)
    public void heartbeat() {
        long now = System.currentTimeMillis();
        if (now - lastTickAt < tickIntervalMs) return;
        lastTickAt = now;
        tick();
    }

    private void tick() {
        List<Asset> assets = activeAssets;
        if (assets.isEmpty()) return;

        double mult = sessionMultiplier();
        Random rng = new Random();
        Map<String, Double> updates = new LinkedHashMap<>();

        for (Asset a : assets) {
            String symbol = a.getSymbol();
            Double currentPrice = prices.get(symbol);
            if (currentPrice == null) currentPrice = a.getBasePrice();
            double change = (rng.nextDouble() - 0.5) * a.getPip() * 10 * mult;
            double newPrice = Math.round((currentPrice + change) * 1e5) / 1e5;
            prices.put(symbol, newPrice);
            updates.put(symbol, newPrice);
        }

        socketServer.getBroadcastOperations().sendEvent("priceUpdate", updates);
    }

    public Map<String, Double> getCurrentPrices() {
        return Collections.unmodifiableMap(prices);
    }

    public List<Asset> getAssets() {
        return activeAssets;
    }
}
