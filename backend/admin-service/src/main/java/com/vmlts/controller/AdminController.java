package com.vmlts.controller;

import com.vmlts.dto.AdminChallengeRequest;
import com.vmlts.dto.AdminLessonRequest;
import com.vmlts.dto.AdminUserUpdateRequest;
import com.vmlts.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @GetMapping("/users")
    public ResponseEntity<?> users() {
        return ResponseEntity.ok(Map.of("users", adminService.getAllUsers()));
    }

    @PatchMapping("/users/{userId}/tier")
    public ResponseEntity<?> updateUser(@PathVariable UUID userId,
                                        @RequestBody AdminUserUpdateRequest req) {
        try {
            return ResponseEntity.ok(adminService.updateUser(userId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable UUID userId) {
        try {
            adminService.deleteUser(userId);
            return ResponseEntity.ok(Map.of("message", "User deleted"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/lessons")
    public ResponseEntity<?> lessons() {
        return ResponseEntity.ok(Map.of("lessons", adminService.getAllLessons()));
    }

    @PostMapping("/lessons")
    public ResponseEntity<?> createLesson(@RequestBody AdminLessonRequest req) {
        try {
            return ResponseEntity.status(201).body(
                    Map.of("message", "Lesson created", "lesson", adminService.createLesson(req)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/lessons/{id}")
    public ResponseEntity<?> deleteLesson(@PathVariable Long id) {
        try {
            adminService.deleteLesson(id);
            return ResponseEntity.ok(Map.of("message", "Lesson deleted"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/challenges")
    public ResponseEntity<?> challenges() {
        return ResponseEntity.ok(Map.of("challenges", adminService.getAllChallenges()));
    }

    @PostMapping("/challenges")
    public ResponseEntity<?> createChallenge(@RequestBody AdminChallengeRequest req) {
        try {
            return ResponseEntity.status(201).body(
                    Map.of("message", "Challenge created", "challenge", adminService.createChallenge(req)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/challenges/{id}")
    public ResponseEntity<?> deleteChallenge(@PathVariable Long id) {
        try {
            adminService.deleteChallenge(id);
            return ResponseEntity.ok(Map.of("message", "Challenge deleted"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/payouts")
    public ResponseEntity<?> payouts() {
        return ResponseEntity.ok(Map.of("payouts", adminService.getPayouts()));
    }

    @PostMapping("/payouts/{id}/mark-paid")
    public ResponseEntity<?> markPayoutPaid(@PathVariable Long id) {
        try {
            adminService.markPayoutPaid(id);
            return ResponseEntity.ok(Map.of("message", "Marked as paid"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/market/assets")
    public ResponseEntity<?> marketAssets() {
        return ResponseEntity.ok(Map.of("assets", adminService.getMarketAssets()));
    }

    @PatchMapping("/market/assets/{id}")
    public ResponseEntity<?> setAssetActive(@PathVariable Long id, @RequestBody Map<String, Boolean> req) {
        try {
            Boolean active = req.get("active");
            if (active == null) return ResponseEntity.badRequest().body(Map.of("message", "active is required"));
            adminService.setAssetActive(id, active);
            return ResponseEntity.ok(Map.of("message", "Asset updated"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/market/settings")
    public ResponseEntity<?> marketSettings() {
        try {
            return ResponseEntity.ok(adminService.getMarketSettings());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PatchMapping("/market/settings")
    public ResponseEntity<?> updateMarketSettings(@RequestBody Map<String, Integer> req) {
        try {
            return ResponseEntity.ok(adminService.updateMarketSettings(req.get("tickIntervalMs")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/notifications")
    public ResponseEntity<?> sendNotification(@RequestBody Map<String, String> req) {
        try {
            return ResponseEntity.ok(adminService.sendNotification(req.get("title"), req.get("body"), req.get("audience")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
