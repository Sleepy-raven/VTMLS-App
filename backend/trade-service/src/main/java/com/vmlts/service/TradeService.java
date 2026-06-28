package com.vmlts.service;

import com.vmlts.dto.OpenTradeRequest;
import com.vmlts.entity.Trade;
import com.vmlts.entity.enums.TradeStatus;
import com.vmlts.entity.enums.TradeType;
import com.vmlts.repository.ChallengeProgressRepository;
import com.vmlts.repository.ChallengeRepository;
import com.vmlts.repository.TradeRepository;
import com.vmlts.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TradeService {

    private final TradeRepository tradeRepository;
    private final UserRepository userRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeProgressRepository challengeProgressRepository;
    private final MarketSimulatorService marketSimulator;

    @Transactional
    public Trade openTrade(UUID userId, OpenTradeRequest req) {
        if (req.getSymbol() == null || req.getType() == null || req.getLotSize() <= 0)
            throw new RuntimeException("Symbol, type and lot size are required");

        Map<String, Double> prices = marketSimulator.getCurrentPrices();
        Double entryPrice = prices.get(req.getSymbol());
        if (entryPrice == null) throw new RuntimeException("Invalid symbol");

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check premium-only assets
        for (var a : marketSimulator.getAssets()) {
            if (a.getSymbol().equals(req.getSymbol()) && a.isPremiumOnly() && !user.isPremium())
                throw new RuntimeException("This asset requires a premium account");
        }

        double cost = req.getLotSize() * entryPrice * 0.01;
        if (user.getBalance().doubleValue() < cost)
            throw new RuntimeException("Insufficient balance");

        Trade trade = new Trade();
        trade.setUserId(userId);
        trade.setSymbol(req.getSymbol());
        trade.setType(TradeType.valueOf(req.getType().toUpperCase()));
        trade.setLotSize(req.getLotSize());
        trade.setEntryPrice(entryPrice);
        trade.setStopLoss(req.getStopLoss());
        trade.setTakeProfit(req.getTakeProfit());
        trade = tradeRepository.save(trade);

        user.setBalance(user.getBalance().subtract(BigDecimal.valueOf(cost)));
        userRepository.save(user);
        updateChallenges(userId);
        return trade;
    }

    @Transactional
    public Map<String, Object> closeTrade(UUID userId, UUID tradeId) {
        Trade trade = tradeRepository.findById(tradeId)
                .orElseThrow(() -> new RuntimeException("Trade not found"));
        if (!trade.getUserId().equals(userId))
            throw new RuntimeException("Trade not found");
        if (trade.getStatus() == TradeStatus.CLOSED)
            throw new RuntimeException("Trade already closed");

        Map<String, Double> prices = marketSimulator.getCurrentPrices();
        double exitPrice = prices.get(trade.getSymbol());
        return closeTradeAtPrice(trade, exitPrice);
    }

    /**
     * Runs every second, right after the market simulator's own price tick, and auto-closes
     * any open trade whose stop-loss or take-profit level has been crossed. Previously
     * stopLoss/takeProfit were only ever saved on the trade at open time and never actually
     * checked against live prices, so trades could blow straight through both levels and just
     * sit open forever — this is the piece that was missing.
     */
    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void checkStopLossAndTakeProfit() {
        try {
            Map<String, Double> prices = marketSimulator.getCurrentPrices();
            List<Trade> openTrades = tradeRepository.findByStatus(TradeStatus.OPEN);
            for (Trade trade : openTrades) {
                Double price = prices.get(trade.getSymbol());
                if (price == null) continue;

                boolean hitSl = trade.getStopLoss() != null && (trade.getType() == TradeType.BUY
                        ? price <= trade.getStopLoss()
                        : price >= trade.getStopLoss());
                boolean hitTp = trade.getTakeProfit() != null && (trade.getType() == TradeType.BUY
                        ? price >= trade.getTakeProfit()
                        : price <= trade.getTakeProfit());

                if (hitSl || hitTp) {
                    // Close at the exact SL/TP level rather than the (possibly overshot)
                    // current tick, so the recorded pnl matches what the user set up.
                    double exitPrice = hitSl ? trade.getStopLoss() : trade.getTakeProfit();
                    closeTradeAtPrice(trade, exitPrice);
                }
            }
        } catch (Exception e) {
            // Non-fatal — never let a bad tick take down the price scheduler
        }
    }

    private Map<String, Object> closeTradeAtPrice(Trade trade, double exitPrice) {
        double priceDiff = trade.getType() == TradeType.BUY
                ? exitPrice - trade.getEntryPrice()
                : trade.getEntryPrice() - exitPrice;
        double pnl = priceDiff * trade.getLotSize() * 10000;

        Map<String, Object> score = calcTradeScore(trade, pnl);

        trade.setExitPrice(exitPrice);
        trade.setPnl(pnl);
        trade.setStatus(TradeStatus.CLOSED);
        trade.setClosedAt(Instant.now());
        trade.setTradeScore((Double) score.get("total"));
        trade.setScoreGrade((String) score.get("grade"));
        trade.setEntryScore((Double) score.get("entryScore"));
        trade.setSlScore((Double) score.get("slScore"));
        trade.setRrScore((Double) score.get("rrScore"));
        trade.setExitScore((Double) score.get("exitScore"));
        trade.setScoreFeedback((String) score.get("feedback"));
        trade = tradeRepository.save(trade);

        UUID userId = trade.getUserId();
        var user = userRepository.findById(userId).orElseThrow();
        double returnedCost = trade.getLotSize() * trade.getEntryPrice() * 0.01;
        user.setBalance(user.getBalance().add(BigDecimal.valueOf(pnl + returnedCost)));
        userRepository.save(user);
        updateChallenges(userId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Trade closed");
        result.put("trade", trade);
        result.put("pnl", pnl);
        result.putAll(score);
        return result;
    }

    public List<Trade> getOpenTrades(UUID userId) {
        return tradeRepository.findByUserIdAndStatusOrderByOpenedAtDesc(userId, TradeStatus.OPEN);
    }

    public List<Trade> getTradeHistory(UUID userId) {
        return tradeRepository.findByUserIdAndStatusOrderByClosedAtDesc(userId, TradeStatus.CLOSED);
    }

    public Map<String, Object> getPrices(UUID userId) {
        var user = userRepository.findById(userId).orElseThrow();
        Map<String, Double> prices = marketSimulator.getCurrentPrices();
        List<Map<String, Object>> assets = new ArrayList<>();
        for (var a : marketSimulator.getAssets()) {
            if (a.isPremiumOnly() && !user.isPremium()) continue;
            Map<String, Object> asset = new LinkedHashMap<>();
            asset.put("symbol", a.getSymbol());
            asset.put("price", prices.getOrDefault(a.getSymbol(), a.getBasePrice()));
            asset.put("premiumOnly", a.isPremiumOnly());
            assets.add(asset);
        }
        return Map.of("assets", assets);
    }

    private Map<String, Object> calcTradeScore(Trade trade, double pnl) {
        double cost = trade.getLotSize() * trade.getEntryPrice() * 0.01;
        double pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

        double entryScore = Math.max(10, Math.min(95,
                pnl >= 0 ? 55 + Math.min(40, Math.abs(pnlPct) * 2)
                         : 45 - Math.min(30, Math.abs(pnlPct) * 1.5)));

        double slScore = (trade.getStopLoss() != null && trade.getStopLoss() > 0) ? 85 : 25;

        double rrScore = 45;
        if (trade.getStopLoss() != null && trade.getTakeProfit() != null
                && trade.getStopLoss() > 0 && trade.getTakeProfit() > 0) {
            double slDist = Math.abs(trade.getEntryPrice() - trade.getStopLoss());
            double tpDist = Math.abs(trade.getTakeProfit() - trade.getEntryPrice());
            double rr = slDist > 0 ? tpDist / slDist : 0;
            rrScore = rr >= 3 ? 95 : rr >= 2 ? 85 : rr >= 1.5 ? 75 : rr >= 1 ? 62 : 35;
        }

        double exitScore = Math.max(15, Math.min(90,
                pnl >= 0 ? 58 + Math.min(30, Math.abs(pnlPct))
                         : 40 - Math.min(25, Math.abs(pnlPct))));

        double total = (entryScore + slScore + rrScore + exitScore) / 4;
        String grade = total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : total >= 40 ? "D" : "F";
        Map<String, String> feedbackMap = Map.of(
                "A", "Excellent execution! Strong entry, solid risk management, and well-timed exit.",
                "B", "Good trade. Tighten your stop-loss placement or improve R:R ratio to reach grade A.",
                "C", "Average trade. Always set stop-loss and take-profit before entering a position.",
                "D", "Needs work. Review your entry criteria and always define risk before opening a trade.",
                "F", "Poor execution. Study your trading plan — risk management is essential every trade."
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("grade", grade);
        result.put("entryScore", entryScore);
        result.put("slScore", slScore);
        result.put("rrScore", rrScore);
        result.put("exitScore", exitScore);
        result.put("feedback", feedbackMap.get(grade));
        return result;
    }

    private void updateChallenges(UUID userId) {
        try {
            var allTrades = tradeRepository.findByUserId(userId);
            var closed = allTrades.stream().filter(t -> t.getStatus() == TradeStatus.CLOSED).toList();
            var winning = closed.stream().filter(t -> t.getPnl() != null && t.getPnl() > 0).toList();
            double totalPnl = closed.stream().mapToDouble(t -> t.getPnl() == null ? 0 : t.getPnl()).sum();
            long uniqueSymbols = allTrades.stream().map(Trade::getSymbol).distinct().count();

            int consecWins = 0;
            for (int i = closed.size() - 1; i >= 0; i--) {
                if (closed.get(i).getPnl() != null && closed.get(i).getPnl() > 0) consecWins++;
                else break;
            }

            var challenges = challengeRepository.findAll();
            for (var ch : challenges) {
                int current = switch (ch.getTitle()) {
                    case "First Trade"                      -> (int) Math.min(allTrades.size(), 1);
                    case "Make 5 Trades"                    -> (int) Math.min(allTrades.size(), 5);
                    case "Achieve a Profitable Trade"       -> winning.isEmpty() ? 0 : 1;
                    case "Weekly Trading Champion"          -> (int) Math.min(allTrades.size(), 10);
                    case "5 Consecutive Winning Trades"     -> Math.min(consecWins, 5);
                    case "Best Monthly P&L"                 -> totalPnl > 0 ? 1 : 0;
                    case "Trade 5 Different Instruments"    -> (int) Math.min(uniqueSymbols, 5);
                    case "Achieve 70% Win Rate (10 trades)" -> {
                        double wr = closed.size() >= 10
                                ? (double) winning.size() / closed.size() * 100 : 0;
                        yield wr >= 70 ? 1 : 0;
                    }
                    default -> -1;
                };
                if (current < 0) continue;

                boolean completed = current >= ch.getTotal();
                var existing = challengeProgressRepository.findByUserIdAndChallengeId(userId, ch.getId());
                var cp = existing.orElse(new com.vmlts.entity.ChallengeProgress());
                cp.setUserId(userId);
                cp.setChallengeId(ch.getId());
                cp.setCurrent(current);
                cp.setCompleted(completed);
                cp.setCompletedAt(completed ? Instant.now() : null);
                challengeProgressRepository.save(cp);
                // Cash prize crediting doesn't happen here — the user claims it themselves
                // via claimChallenge() once the challenge shows as completed in the app (an
                // admin can also trigger it as a manual fallback from Prize Payouts).
            }
        } catch (Exception e) {
            // Non-fatal — don't block trade operations
        }
    }

    // Triggered when the user taps a completed cash-prize challenge in the app — this is the
    // actual payout trigger. The admin's Prize Payouts screen reads the same `paid` flag this
    // sets, so a claim here shows green there too; the `paid` guard prevents double-crediting
    // if an admin also taps their button for the same record.
    @Transactional
    public Map<String, Object> claimChallenge(UUID userId, Long challengeId) {
        var challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new RuntimeException("Challenge not found"));
        var cp = challengeProgressRepository.findByUserIdAndChallengeId(userId, challengeId)
                .orElseThrow(() -> new RuntimeException("Challenge not completed yet"));
        if (!cp.isCompleted()) throw new RuntimeException("Challenge not completed yet");
        if (cp.isPaid()) throw new RuntimeException("Prize already claimed");

        BigDecimal prize = parseCashPrize(challenge.getCashPrize());
        if (prize.compareTo(BigDecimal.ZERO) <= 0) throw new RuntimeException("This challenge has no cash prize");

        var user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        user.setBalance(user.getBalance().add(prize));
        userRepository.save(user);

        cp.setPaid(true);
        cp.setPaidAt(Instant.now());
        challengeProgressRepository.save(cp);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Prize claimed");
        result.put("amount", prize);
        result.put("balance", user.getBalance());
        return result;
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
}
