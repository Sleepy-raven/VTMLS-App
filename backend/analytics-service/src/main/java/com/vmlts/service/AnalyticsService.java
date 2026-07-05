package com.vmlts.service;

import com.vmlts.entity.Trade;
import com.vmlts.entity.enums.TradeStatus;
import com.vmlts.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TradeRepository tradeRepository;

    public Map<String, Object> getAnalytics(UUID userId) {
        var trades = tradeRepository.findByUserIdOrderByOpenedAtDesc(userId);
        var closed = trades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED).toList();
        var open   = trades.stream().filter(t -> t.getStatus() == TradeStatus.OPEN).toList();
        var profitable = closed.stream().filter(t -> t.getPnl() != null && t.getPnl() > 0).toList();
        var losing     = closed.stream().filter(t -> t.getPnl() != null && t.getPnl() < 0).toList();

        double totalPnl = closed.stream().mapToDouble(t -> t.getPnl() == null ? 0 : t.getPnl()).sum();
        double winRate  = closed.isEmpty() ? 0 : (double) profitable.size() / closed.size() * 100;
        double avgWin   = profitable.isEmpty() ? 0 :
                profitable.stream().mapToDouble(t -> t.getPnl() == null ? 0 : t.getPnl()).average().orElse(0);
        double avgLoss  = losing.isEmpty() ? 0 :
                Math.abs(losing.stream().mapToDouble(t -> t.getPnl() == null ? 0 : t.getPnl()).average().orElse(0));

        // Asset win rates
        Map<String, int[]> assetMap = new LinkedHashMap<>();
        closed.forEach(t -> {
            assetMap.computeIfAbsent(t.getSymbol(), k -> new int[]{0, 0});
            assetMap.get(t.getSymbol())[1]++;
            if (t.getPnl() != null && t.getPnl() > 0) assetMap.get(t.getSymbol())[0]++;
        });
        List<Map<String, Object>> assetWinRates = assetMap.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("asset", e.getKey());
                    m.put("winRate", (int) Math.round((double) e.getValue()[0] / e.getValue()[1] * 100));
                    m.put("trades", e.getValue()[1]);
                    return m;
                })
                .sorted((a, b) -> (int) b.get("trades") - (int) a.get("trades"))
                .toList();

        // Feedback
        List<String> feedback = new ArrayList<>();
        if (closed.isEmpty()) {
            feedback.add("Place your first trade to start receiving performance feedback.");
        } else {
            if (winRate >= 60) feedback.add("Strong win rate! You are winning more than 60% of your trades.");
            else if (winRate >= 40) feedback.add("Decent win rate. Focus on improving your entry timing to push above 60%.");
            else feedback.add("Win rate below 40%. Review your entry criteria and wait for higher quality setups.");

            if (avgWin > avgLoss)
                feedback.add(String.format("Your average win ($%.2f) exceeds your average loss ($%.2f) — excellent risk/reward.", avgWin, avgLoss));
            else
                feedback.add(String.format("Your average loss ($%.2f) exceeds your average win ($%.2f). Tighten stop losses or let winners run longer.", avgLoss, avgWin));

            long slCount = closed.stream().filter(t -> t.getStopLoss() != null).count();
            double slUsage = (double) slCount / closed.size() * 100;
            if (slUsage < 50) feedback.add("Less than 50% of your trades used a stop loss. Always set a stop loss before entering.");
            else feedback.add(String.format("%d%% of your trades used a stop loss. Good risk management discipline.", (int) Math.round(slUsage)));

            if (totalPnl > 0)
                feedback.add(String.format("Overall profitable with $%.2f total P&L. Keep following your strategy.", totalPnl));
            else
                feedback.add(String.format("Currently down $%.2f overall. Focus on risk management and smaller position sizes.", Math.abs(totalPnl)));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalTrades", trades.size());
        result.put("openTrades", open.size());
        result.put("closedTrades", closed.size());
        result.put("profitableTrades", profitable.size());
        result.put("totalPnl", Math.round(totalPnl * 100.0) / 100.0);
        result.put("winRate", Math.round(winRate * 100.0) / 100.0);
        result.put("avgWin", Math.round(avgWin * 100.0) / 100.0);
        result.put("avgLoss", Math.round(avgLoss * 100.0) / 100.0);
        result.put("assetWinRates", assetWinRates);
        result.put("feedback", feedback);
        result.put("trades", closed.stream().limit(10).toList());
        return result;
    }
}
