package com.vmlts.service;

import com.vmlts.dto.AuthResponse;
import com.vmlts.dto.ChangePasswordRequest;
import com.vmlts.dto.ForgotPasswordRequest;
import com.vmlts.dto.LoginRequest;
import com.vmlts.dto.RegisterRequest;
import com.vmlts.dto.ResetPasswordRequest;
import com.vmlts.entity.User;
import com.vmlts.entity.enums.TradeStatus;
import com.vmlts.repository.TradeRepository;
import com.vmlts.repository.UserRepository;
import com.vmlts.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TradeRepository tradeRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    private static final List<String> ALLOWED_DOMAINS =
            Arrays.asList("gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com");

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$");

    // At least 6 characters, with letters and (numbers or symbols) — mirrors the frontend
    // LoginScreen rule so this can't be bypassed by calling the API directly.
    private static final Pattern PASSWORD_LETTER = Pattern.compile("[A-Za-z]");
    private static final Pattern PASSWORD_NUMBER_OR_SYMBOL = Pattern.compile("[0-9\\W_]");
    private static final String PASSWORD_HINT =
            "Password must be at least 6 characters and include letters and numbers or symbols";

    // Emails are case-insensitive per RFC but Postgres' unique constraint on `email` isn't —
    // without this, "User@gmail.com" and "user@gmail.com" would register as two separate
    // accounts, silently defeating the duplicate-email check. Every path that looks up,
    // stores, or compares an email now goes through this first.
    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private boolean isValidEmailDomain(String email) {
        String[] parts = email.split("@");
        return parts.length == 2 && ALLOWED_DOMAINS.contains(parts[1].toLowerCase());
    }

    private boolean isValidEmailFormat(String email) {
        return email != null && EMAIL_PATTERN.matcher(email).matches();
    }

    private boolean isValidPassword(String password) {
        return password != null && password.length() >= 6
                && PASSWORD_LETTER.matcher(password).find()
                && PASSWORD_NUMBER_OR_SYMBOL.matcher(password).find();
    }

    @Transactional
    public Map<String, Object> register(RegisterRequest req) {
        if (req.getName() == null || req.getEmail() == null || req.getPassword() == null)
            throw new RuntimeException("All fields are required");
        String email = normalizeEmail(req.getEmail());
        if (!isValidEmailDomain(email))
            throw new RuntimeException("Only " + String.join(", ", ALLOWED_DOMAINS) + " email addresses are allowed");
        if (!isValidPassword(req.getPassword()))
            throw new RuntimeException(PASSWORD_HINT);
        if (userRepository.existsByEmail(email))
            throw new RuntimeException("Email already registered");

        User user = new User();
        user.setName(req.getName());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setEmailVerified(false);
        String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        user.setVerificationCode(code);
        user.setVerificationCodeExpiry(Instant.now().plus(15, ChronoUnit.MINUTES));
        userRepository.save(user);

        emailService.sendVerificationCode(email, code);

        // No token yet — the account can't log in until verifyEmail() confirms the code.
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Verification code sent to your email");
        result.put("requiresVerification", true);
        result.put("email", email);
        return result;
    }

    // Completes registration once the emailed code is confirmed — this is the only place a
    // brand-new account actually receives its first JWT.
    @Transactional
    public AuthResponse verifyEmail(String rawEmail, String code) {
        String email = normalizeEmail(rawEmail);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid or expired code"));
        if (user.isEmailVerified()) {
            String token = jwtTokenProvider.generateToken(user.getId(), user.getRole().name(), user.isPremium());
            return new AuthResponse("Already verified", token, toDto(user));
        }
        if (code == null || code.isBlank()
                || user.getVerificationCode() == null
                || user.getVerificationCodeExpiry() == null
                || !user.getVerificationCode().equals(code)
                || Instant.now().isAfter(user.getVerificationCodeExpiry())) {
            throw new RuntimeException("Invalid or expired code");
        }
        user.setEmailVerified(true);
        user.setVerificationCode(null);
        user.setVerificationCodeExpiry(null);
        userRepository.save(user);

        String token = jwtTokenProvider.generateToken(user.getId(), user.getRole().name(), user.isPremium());
        return new AuthResponse("Email verified", token, toDto(user));
    }

    @Transactional
    public void resendVerificationCode(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        var userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty() || userOpt.get().isEmailVerified()) {
            // Don't reveal account existence/verification state to the caller.
            return;
        }
        User user = userOpt.get();
        String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        user.setVerificationCode(code);
        user.setVerificationCodeExpiry(Instant.now().plus(15, ChronoUnit.MINUTES));
        userRepository.save(user);
        emailService.sendVerificationCode(email, code);
    }

    public AuthResponse login(LoginRequest req) {
        if (req.getEmail() == null || req.getPassword() == null)
            throw new RuntimeException("Email and password required");
        String email = normalizeEmail(req.getEmail());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword()))
            throw new RuntimeException("Invalid email or password");
        if (!user.isEmailVerified())
            throw new RuntimeException("Please verify your email before logging in");
        String token = jwtTokenProvider.generateToken(user.getId(), user.getRole().name(), user.isPremium());
        return new AuthResponse("Login successful", token, toDto(user));
    }

    public AuthResponse.UserDto getProfile(UUID userId) {
        return toDto(userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found")));
    }

    // Mints a fresh JWT with the user's current role/isPremium from the database. The
    // isPremium claim is baked into the token at issue time (every service trusts the JWT
    // claim rather than doing a live DB lookup per request), so without this, a user who
    // upgrades mid-session would keep seeing "free" behavior everywhere until they log out
    // and back in. The client calls this right after a payment is confirmed and swaps its
    // stored token, so the very next request anywhere carries the correct premium status.
    public AuthResponse refreshToken(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        String token = jwtTokenProvider.generateToken(user.getId(), user.getRole().name(), user.isPremium());
        return new AuthResponse("Token refreshed", token, toDto(user));
    }

    @Transactional
    public void registerPushToken(UUID userId, String token) {
        if (token == null || token.isBlank()) throw new RuntimeException("Token is required");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPushToken(token);
        userRepository.save(user);
    }

    @Transactional
    public BigDecimal resetBalance(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        BigDecimal newBalance = user.isPremium() ? BigDecimal.valueOf(10000) : BigDecimal.valueOf(1000);

        var openTrades = tradeRepository.findByUserIdAndStatusOrderByOpenedAtDesc(userId, TradeStatus.OPEN);
        openTrades.forEach(t -> {
            t.setStatus(TradeStatus.CLOSED);
            t.setExitPrice(0.0);
            t.setPnl(0.0);
            t.setClosedAt(Instant.now());
        });
        tradeRepository.saveAll(openTrades);
        user.setBalance(newBalance);
        userRepository.save(user);
        return newBalance;
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        if (req.getCurrentPassword() == null || req.getNewPassword() == null)
            throw new RuntimeException("Current and new password are required");
        if (!isValidPassword(req.getNewPassword()))
            throw new RuntimeException(PASSWORD_HINT);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword()))
            throw new RuntimeException("Current password is incorrect");

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest req) {
        if (!isValidEmailFormat(req.getEmail()))
            throw new RuntimeException("Please enter a valid email address");
        String email = normalizeEmail(req.getEmail());

        var userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            // Don't reveal whether an account exists for this email — fail silently from the caller's view.
            return;
        }
        User user = userOpt.get();
        String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        user.setResetCode(code);
        user.setResetCodeExpiry(Instant.now().plus(15, ChronoUnit.MINUTES));
        userRepository.save(user);

        emailService.sendPasswordResetCode(user.getEmail(), code);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        if (!isValidEmailFormat(req.getEmail()))
            throw new RuntimeException("Please enter a valid email address");
        if (req.getCode() == null || req.getCode().isBlank())
            throw new RuntimeException("Reset code is required");
        if (!isValidPassword(req.getNewPassword()))
            throw new RuntimeException(PASSWORD_HINT);

        User user = userRepository.findByEmail(normalizeEmail(req.getEmail()))
                .orElseThrow(() -> new RuntimeException("Invalid or expired code"));

        if (user.getResetCode() == null
                || user.getResetCodeExpiry() == null
                || !user.getResetCode().equals(req.getCode())
                || Instant.now().isAfter(user.getResetCodeExpiry())) {
            throw new RuntimeException("Invalid or expired code");
        }

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        user.setResetCode(null);
        user.setResetCodeExpiry(null);
        userRepository.save(user);
    }

    // Step 1 of account deletion: emails a verification code, same pattern as forgot-password.
    // Nothing is flagged yet — the request only becomes visible to admins once the code is
    // confirmed via confirmAccountDeletion below.
    @Transactional
    public void requestDeletionCode(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        user.setDeletionCode(code);
        user.setDeletionCodeExpiry(Instant.now().plus(15, ChronoUnit.MINUTES));
        userRepository.save(user);
        emailService.sendAccountDeletionCode(user.getEmail(), code);
    }

    // Step 2: verifying the emailed code is what actually raises the flag admins see on
    // Manage Users. This never deletes the account itself — that stays a manual admin action.
    @Transactional
    public void confirmAccountDeletion(UUID userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (code == null || code.isBlank()
                || user.getDeletionCode() == null
                || user.getDeletionCodeExpiry() == null
                || !user.getDeletionCode().equals(code)
                || Instant.now().isAfter(user.getDeletionCodeExpiry())) {
            throw new RuntimeException("Invalid or expired code");
        }
        user.setDeletionRequested(true);
        user.setDeletionRequestedAt(Instant.now());
        user.setDeletionCode(null);
        user.setDeletionCodeExpiry(null);
        userRepository.save(user);
    }

    private AuthResponse.UserDto toDto(User user) {
        return new AuthResponse.UserDto(
                user.getId(), user.getName(), user.getEmail(),
                user.getRole().name().toLowerCase(),
                user.isPremium(), user.getBalance(),
                user.getTier().name().toLowerCase(),
                user.getSubscriptionPlan(),
                user.getSubscriptionStatus(),
                user.getCurrentPeriodEnd(),
                user.getProfilePhoto()
        );
    }

    // Lets a learner change their display name and/or profile photo from the app. Either
    // field can be omitted (null) to leave it unchanged — e.g. changing just the name without
    // re-uploading the photo. A blank/empty-string photo explicitly clears it (removes photo).
    @Transactional
    public AuthResponse.UserDto updateProfile(UUID userId, String name, String profilePhoto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (name != null) {
            String trimmed = name.trim();
            if (trimmed.isEmpty()) throw new RuntimeException("Name cannot be empty");
            if (trimmed.length() > 60) throw new RuntimeException("Name is too long");
            user.setName(trimmed);
        }
        if (profilePhoto != null) {
            // Rough cap so nobody can stuff an enormous string in — the frontend already
            // resizes/compresses before upload, this is just a backstop.
            if (profilePhoto.length() > 2_000_000) throw new RuntimeException("Image is too large");
            user.setProfilePhoto(profilePhoto.isEmpty() ? null : profilePhoto);
        }

        userRepository.save(user);
        return toDto(user);
    }
}
