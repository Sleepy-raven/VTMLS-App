package com.vmlts.controller;

import com.vmlts.dto.ChangePasswordRequest;
import com.vmlts.dto.ForgotPasswordRequest;
import com.vmlts.dto.LoginRequest;
import com.vmlts.dto.RegisterRequest;
import com.vmlts.dto.ResetPasswordRequest;
import com.vmlts.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        try {
            return ResponseEntity.status(201).body(authService.register(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        try {
            return ResponseEntity.ok(authService.login(req));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<?> profile(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(Map.of("user", authService.getProfile(userId)));
    }

    // Called by the client right after a payment/subscription is confirmed, so the JWT's
    // isPremium claim (which every service trusts without a DB lookup) updates immediately
    // instead of only on next login.
    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshToken(Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            return ResponseEntity.ok(authService.refreshToken(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(authService.verifyEmail(body.get("email"), body.get("code")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/resend-verification-code")
    public ResponseEntity<?> resendVerificationCode(@RequestBody Map<String, String> body) {
        try {
            authService.resendVerificationCode(body.get("email"));
            return ResponseEntity.ok(Map.of("message", "If that account needs verification, a new code has been sent."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest req) {
        try {
            authService.forgotPassword(req);
            // Always return a generic success message, regardless of whether the email exists,
            // so this endpoint can't be used to check which emails are registered.
            return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset code has been sent."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest req) {
        try {
            authService.resetPassword(req);
            return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req, Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            authService.changePassword(userId, req);
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PatchMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body, Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            var updated = authService.updateProfile(userId, body.get("name"), body.get("profilePhoto"));
            return ResponseEntity.ok(Map.of("message", "Profile updated", "user", updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/push-token")
    public ResponseEntity<?> registerPushToken(@RequestBody Map<String, String> body, Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            authService.registerPushToken(userId, body.get("token"));
            return ResponseEntity.ok(Map.of("message", "Push token registered"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/request-deletion-code")
    public ResponseEntity<?> requestDeletionCode(Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            authService.requestDeletionCode(userId);
            return ResponseEntity.ok(Map.of("message", "Verification code sent to your email"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/confirm-deletion")
    public ResponseEntity<?> confirmDeletion(@RequestBody Map<String, String> body, Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            authService.confirmAccountDeletion(userId, body.get("code"));
            return ResponseEntity.ok(Map.of("message", "Request sent"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-balance")
    public ResponseEntity<?> resetBalance(Authentication auth) {
        try {
            UUID userId = UUID.fromString(auth.getName());
            var balance = authService.resetBalance(userId);
            return ResponseEntity.ok(Map.of("message", "Balance reset successfully", "balance", balance));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
