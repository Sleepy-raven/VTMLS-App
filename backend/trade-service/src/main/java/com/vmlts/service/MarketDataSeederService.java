package com.vmlts.service;

import com.vmlts.entity.Asset;
import com.vmlts.entity.MarketSettings;
import com.vmlts.repository.AssetRepository;
import com.vmlts.repository.MarketSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * One-time seed of the assets/market_settings tables, run only if they're empty — unlike
 * DataSeederService's upsert-by-title pattern (lessons/challenges), this must NOT re-run on
 * every restart, or it would silently overwrite whatever an admin toggled active/inactive
 * via the Market Control screen.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataSeederService {

    private final AssetRepository assetRepository;
    private final MarketSettingsRepository marketSettingsRepository;

    // {symbol, basePrice, pip, premiumOnly} — the original hardcoded values from
    // MarketSimulatorService, now the seed data for the assets table.
    private static final Object[][] SEED_ASSETS = {
        {"EUR/USD", 1.08542, 0.00001, false},
        {"GBP/USD", 1.27381, 0.00001, true},
        {"USD/JPY", 149.832, 0.001,   true},
        {"AUD/USD", 0.65210, 0.00001, true},
        {"USD/CAD", 1.36450, 0.00001, true},
        {"EUR/GBP", 0.85123, 0.00001, true},
        {"US30",    38542.0, 0.1,     true},
        {"US500",   5021.30, 0.01,    true},
        {"NAS100",  17832.5, 0.1,     true},
        {"UK100",   7654.20, 0.1,     true},
        {"GER40",   17234.0, 0.1,     true},
        {"XAU/USD", 2342.50, 0.01,    false},
        {"XAG/USD", 27.845,  0.001,   true},
        {"WTI",     78.320,  0.001,   true},
    };

    private static final int DEFAULT_TICK_INTERVAL_MS = 1000;

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        if (assetRepository.count() == 0) {
            List<Asset> assets = new java.util.ArrayList<>();
            for (Object[] a : SEED_ASSETS) {
                assets.add(Asset.builder()
                        .symbol((String) a[0])
                        .basePrice((Double) a[1])
                        .pip((Double) a[2])
                        .premiumOnly((Boolean) a[3])
                        .active(true)
                        .build());
            }
            assetRepository.saveAll(assets);
            log.info("Seeded {} market assets", assets.size());
        }

        if (marketSettingsRepository.count() == 0) {
            marketSettingsRepository.save(MarketSettings.builder()
                    .id(1L)
                    .tickIntervalMs(DEFAULT_TICK_INTERVAL_MS)
                    .build());
            log.info("Seeded default market settings (tickIntervalMs={})", DEFAULT_TICK_INTERVAL_MS);
        }
    }
}
