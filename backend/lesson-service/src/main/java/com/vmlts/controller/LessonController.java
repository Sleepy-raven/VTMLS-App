package com.vmlts.controller;

import com.vmlts.dto.LessonProgressRequest;
import com.vmlts.service.CertificateService;
import com.vmlts.service.LessonService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/learn")
@RequiredArgsConstructor
public class LessonController {

    private final LessonService lessonService;
    private final CertificateService certificateService;

    @GetMapping("/lessons")
    public ResponseEntity<?> getLessons() {
        return ResponseEntity.ok(Map.of("lessons", lessonService.getLessons()));
    }

    @GetMapping("/lessons/progress")
    public ResponseEntity<?> getLessonProgress(Authentication auth) {
        return ResponseEntity.ok(Map.of("progress",
                lessonService.getLessonProgress(UUID.fromString(auth.getName()))));
    }

    @PostMapping("/lessons/{lessonId}/progress")
    public ResponseEntity<?> updateLessonProgress(@PathVariable Long lessonId,
                                                   @RequestBody LessonProgressRequest req,
                                                   Authentication auth) {
        try {
            boolean isPremium = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("PREMIUM"));
            var result = lessonService.updateLessonProgress(UUID.fromString(auth.getName()), lessonId, req, isPremium);
            return ResponseEntity.ok(Map.of("progress", result));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/certificates")
    public ResponseEntity<?> getCertificateProgress(Authentication auth) {
        return ResponseEntity.ok(lessonService.getCertificateProgress(UUID.fromString(auth.getName())));
    }

    // "type" is "forexFundamentals" or "certifiedForexTrader". `name` is passed by the app
    // (from the logged-in user's profile) since lesson-service doesn't own user records —
    // it only checks eligibility via this user's own lesson progress, keyed by their JWT.
    // POST (not GET) specifically so `name` travels in the JSON body rather than a URL query
    // string — display names can contain emoji/unicode that percent-encode to multi-byte
    // sequences some servers/gateways reject in a query string before it reaches this code.
    @PostMapping("/certificates/{type}/download")
    public ResponseEntity<?> downloadCertificate(@PathVariable String type,
                                                  @RequestBody(required = false) Map<String, String> body,
                                                  Authentication auth) {
        String name = (body != null && body.get("name") != null && !body.get("name").isBlank())
                ? body.get("name") : "VMLTS Learner";
        var progress = lessonService.getCertificateProgress(UUID.fromString(auth.getName()));
        Map<?, ?> entry = (Map<?, ?>) progress.get(type);
        if (entry == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unknown certificate type"));
        }
        if (!Boolean.TRUE.equals(entry.get("earned"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Certificate not yet earned"));
        }
        String courseTitle = type.equals("certifiedForexTrader") ? "CERTIFIED FOREX TRADER" : "FOREX FUNDAMENTALS";
        byte[] pdf = certificateService.generate(name, courseTitle, "Nathaniel Voss");
        String filename = (type.equals("certifiedForexTrader") ? "Certified_Forex_Trader" : "Forex_Fundamentals")
                + "_Certificate.pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/challenges")
    public ResponseEntity<?> getChallenges() {
        return ResponseEntity.ok(Map.of("challenges", lessonService.getChallenges()));
    }

    @GetMapping("/challenges/progress")
    public ResponseEntity<?> getChallengeProgress(Authentication auth) {
        return ResponseEntity.ok(Map.of("progress",
                lessonService.getChallengeProgress(UUID.fromString(auth.getName()))));
    }

   @PostMapping("/challenges/{challengeId}/progress")
public ResponseEntity<?> updateChallengeProgress(@PathVariable Long challengeId,
                                                  @RequestBody Map<String, Integer> body,
                                                  Authentication auth) {
    try {
        var result = lessonService.updateChallengeProgress(
                UUID.fromString(auth.getName()), challengeId, body.getOrDefault("current", 0));
        return ResponseEntity.ok(Map.of("progress", result));
    } catch (RuntimeException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
}