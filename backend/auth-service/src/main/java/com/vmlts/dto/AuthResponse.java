package com.vmlts.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.UUID;

@Data @AllArgsConstructor @NoArgsConstructor
public class AuthResponse {
    private String message;
    private String token;
    private UserDto user;

    @Data @AllArgsConstructor @NoArgsConstructor
    public static class UserDto {
        private UUID id;
        private String name;
        private String email;
        private String role;
        // Explicit @JsonProperty is required: Lombok's generated getter stays isPremium()
        // (it doesn't double the "is" prefix), but Jackson's default naming convention then
        // strips "is" again when deriving the JSON key, producing "premium" instead of
        // "isPremium". The frontend reads user.isPremium (not .premium) everywhere — login,
        // register, profile, refresh-token all go through this DTO, so without this fix the
        // app could never correctly detect a real premium user via the API at all.
        @JsonProperty("isPremium")
        private boolean isPremium;
        private BigDecimal balance;
        private String tier;
        private String subscriptionPlan;
        private String subscriptionStatus;
        private java.time.Instant currentPeriodEnd;
        // Base64-encoded image (no data:image/... prefix — the frontend adds that when
        // rendering). Frontend compresses/resizes before upload to keep this reasonably small.
        private String profilePhoto;
    }
}
