package com.vmlts.controller;

import com.vmlts.dto.OpenTradeRequest;
import com.vmlts.service.TradeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {

    private final TradeService tradeService;

    @GetMapping("/prices")
    public ResponseEntity<?> getPrices(Authentication auth) {
        return ResponseEntity.ok(tradeService.getPrices(UUID.fromString(auth.getName())));
    }

    @PostMapping("/open")
    public ResponseEntity<?> openTrade(@RequestBody OpenTradeRequest req, Authentication auth) {
        try {
            var trade = tradeService.openTrade(UUID.fromString(auth.getName()), req);
            return ResponseEntity.status(201).body(Map.of("message", "Trade opened", "trade", trade));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/close/{tradeId}")
    public ResponseEntity<?> closeTrade(@PathVariable UUID tradeId, Authentication auth) {
        try {
            return ResponseEntity.ok(tradeService.closeTrade(UUID.fromString(auth.getName()), tradeId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/open")
    public ResponseEntity<?> getOpenTrades(Authentication auth) {
        return ResponseEntity.ok(Map.of("trades", tradeService.getOpenTrades(UUID.fromString(auth.getName()))));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getTradeHistory(Authentication auth) {
        return ResponseEntity.ok(Map.of("trades", tradeService.getTradeHistory(UUID.fromString(auth.getName()))));
    }

    @PostMapping("/challenges/{challengeId}/claim")
    public ResponseEntity<?> claimChallenge(@PathVariable Long challengeId, Authentication auth) {
        try {
            return ResponseEntity.ok(tradeService.claimChallenge(UUID.fromString(auth.getName()), challengeId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
