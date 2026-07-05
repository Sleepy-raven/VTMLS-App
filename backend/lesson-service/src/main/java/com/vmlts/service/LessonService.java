package com.vmlts.service;

import com.vmlts.dto.LessonProgressRequest;
import com.vmlts.entity.Lesson;
import com.vmlts.entity.LessonProgress;
import com.vmlts.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LessonService {

    private final LessonRepository lessonRepository;
    private final LessonProgressRepository lessonProgressRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeProgressRepository challengeProgressRepository;

    public Object getLessons() {
        return lessonRepository.findAllOrdered();
    }

    public List<LessonProgress> getLessonProgress(UUID userId) {
        return lessonProgressRepository.findByUserId(userId);
    }

    @Transactional
    public LessonProgress updateLessonProgress(UUID userId, Long lessonId, LessonProgressRequest req, boolean isPremiumUser) {
        // Real enforcement point — the frontend already blocks tapping into a premium lesson
        // for free users, but that's UI-only and bypassable by calling this endpoint directly.
        var lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new RuntimeException("Lesson not found"));
        if (lesson.isPremium() && !isPremiumUser) {
            throw new RuntimeException("Upgrade to Premium to access this lesson");
        }

        boolean isCompleted = req.getCompleted() != null ? req.getCompleted()
                : (req.getProgress() != null && req.getProgress() >= 100);
        Integer score = req.getScore() != null ? req.getScore()
                : (req.getProgress() != null ? req.getProgress() : null);

        var existing = lessonProgressRepository.findByUserIdAndLessonId(userId, lessonId);
        LessonProgress lp = existing.orElse(new LessonProgress());
        lp.setUserId(userId);
        lp.setLessonId(lessonId);
        lp.setCompleted(isCompleted);
        lp.setScore(score);
        lp.setCompletedAt(isCompleted ? Instant.now() : null);
        lp = lessonProgressRepository.save(lp);

        // Update "Complete 3 Lessons" challenge
        updateLessonChallenge(userId);
        return lp;
    }

    // Real, server-computed replacement for the frontend's old hardcoded "5 completed" /
    // "7 completed" thresholds — Forex Fundamentals tracks free lessons, Certified Forex
    // Trader tracks premium lessons, both derived from the actual seeded lesson set.
    public Map<String, Object> getCertificateProgress(UUID userId) {
        List<Lesson> lessons = lessonRepository.findAllOrdered();
        Set<Long> completedIds = lessonProgressRepository.findByUserId(userId).stream()
                .filter(LessonProgress::isCompleted)
                .map(LessonProgress::getLessonId)
                .collect(Collectors.toSet());

        long freeTotal = lessons.stream().filter(l -> !l.isPremium()).count();
        long freeCompleted = lessons.stream().filter(l -> !l.isPremium() && completedIds.contains(l.getId())).count();
        long premiumTotal = lessons.stream().filter(Lesson::isPremium).count();
        long premiumCompleted = lessons.stream().filter(l -> l.isPremium() && completedIds.contains(l.getId())).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("forexFundamentals", certEntry(freeCompleted, freeTotal));
        result.put("certifiedForexTrader", certEntry(premiumCompleted, premiumTotal));
        return result;
    }

    private Map<String, Object> certEntry(long completed, long total) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("completed", completed);
        m.put("total", total);
        m.put("earned", total > 0 && completed >= total);
        return m;
    }

    public List<?> getChallenges() {
        return challengeRepository.findAll();
    }

    public List<?> getChallengeProgress(UUID userId) {
        return challengeProgressRepository.findByUserId(userId);
    }

    @Transactional
    public Object updateChallengeProgress(UUID userId, Long challengeId, int current) {
        var ch = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new RuntimeException("Challenge not found"));
        boolean completed = current >= ch.getTotal();
        var existing = challengeProgressRepository.findByUserIdAndChallengeId(userId, challengeId);
        var cp = existing.orElse(new com.vmlts.entity.ChallengeProgress());
        cp.setUserId(userId);
        cp.setChallengeId(challengeId);
        cp.setCurrent(current);
        cp.setCompleted(completed);
        cp.setCompletedAt(completed ? Instant.now() : null);
        return challengeProgressRepository.save(cp);
    }

    private void updateLessonChallenge(UUID userId) {
        try {
            long completedCount = lessonProgressRepository.findByUserId(userId)
                    .stream().filter(LessonProgress::isCompleted).count();
            challengeRepository.findByTitle("Complete 3 Lessons").ifPresent(ch -> {
                int current = (int) Math.min(completedCount, 3);
                boolean done = current >= 3;
                var existing = challengeProgressRepository.findByUserIdAndChallengeId(userId, ch.getId());
                var cp = existing.orElse(new com.vmlts.entity.ChallengeProgress());
                cp.setUserId(userId);
                cp.setChallengeId(ch.getId());
                cp.setCurrent(current);
                cp.setCompleted(done);
                cp.setCompletedAt(done ? Instant.now() : null);
                challengeProgressRepository.save(cp);
            });
        } catch (Exception ignored) {}
    }
}
