package com.vmlts.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendPasswordResetCode(String toEmail, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Your VMLTS password reset code");
            message.setText(
                "Your password reset code is: " + code + "\n\n" +
                "This code expires in 15 minutes. If you didn't request a password reset, " +
                "you can safely ignore this email.\n\n" +
                "— The VMLTS Team"
            );
            mailSender.send(message);
            log.info("Password reset email sent to {}", maskEmail(toEmail));
        } catch (Exception e) {
            // Never let a mail failure crash the app or the request that triggered it.
            log.error("Failed to send password reset email to {}: {}", maskEmail(toEmail), e.getMessage());
        }
    }

    @Async
    public void sendAccountDeletionCode(String toEmail, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Confirm your VMLTS account deletion request");
            message.setText(
                "Your account deletion verification code is: " + code + "\n\n" +
                "Enter this code in the app to confirm you want to request deletion of your " +
                "VMLTS account. This code expires in 15 minutes. If you didn't request this, " +
                "you can safely ignore this email — your account is safe.\n\n" +
                "— The VMLTS Team"
            );
            mailSender.send(message);
            log.info("Account deletion code email sent to {}", maskEmail(toEmail));
        } catch (Exception e) {
            log.error("Failed to send account deletion code email to {}: {}", maskEmail(toEmail), e.getMessage());
        }
    }

    @Async
    public void sendVerificationCode(String toEmail, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Verify your VMLTS account");
            message.setText(
                "Welcome to VMLTS! Your email verification code is: " + code + "\n\n" +
                "Enter this code in the app to activate your account. This code expires in " +
                "15 minutes.\n\n" +
                "— The VMLTS Team"
            );
            mailSender.send(message);
            log.info("Verification code email sent to {}", maskEmail(toEmail));
        } catch (Exception e) {
            log.error("Failed to send verification code email to {}: {}", maskEmail(toEmail), e.getMessage());
        }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + email.substring(at);
        return email.charAt(0) + "***" + email.substring(at);
    }
}
