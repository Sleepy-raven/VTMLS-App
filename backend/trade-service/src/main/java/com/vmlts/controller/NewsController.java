package com.vmlts.controller;

import com.vmlts.repository.UserRepository;
import com.vmlts.service.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getNews(@RequestParam(required = false) String category) {
        try {
            return ResponseEntity.ok(newsService.getNews(category));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Failed to fetch news"));
        }
    }

    @GetMapping("/premium")
    public ResponseEntity<?> getPremiumNews(Authentication auth) {
        try {
            var user = userRepository.findById(UUID.fromString(auth.getName())).orElseThrow();
            if (!user.isPremium())
                return ResponseEntity.status(403).body(Map.of("message", "Premium access required"));
            return ResponseEntity.ok(newsService.getPremiumNews());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Failed to fetch news"));
        }
    }

    @GetMapping("/calendar")
    public ResponseEntity<?> getCalendar() {
        try {
            return ResponseEntity.ok(newsService.getCalendar());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Failed to fetch calendar"));
        }
    }
}
