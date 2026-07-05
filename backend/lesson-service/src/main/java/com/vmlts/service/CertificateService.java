package com.vmlts.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.time.Instant;

/**
 * Renders the two VMLTS certificates (Forex Fundamentals, Certified Forex Trader) as a PDF,
 * matching the navy/gold design of the Word template this was based on. Kept deliberately
 * simple (PDFBox primitives, no external template files) so it has no dependency on assets
 * that could go missing between environments.
 */
@Service
public class CertificateService {

    private static final float NAVY_R = 0x1F / 255f, NAVY_G = 0x2A / 255f, NAVY_B = 0x44 / 255f;
    private static final float GOLD_R = 0x8A / 255f, GOLD_G = 0x7A / 255f, GOLD_B = 0x3E / 255f;

    public byte[] generate(String recipientName, String courseTitle, String signerName) {
        String cleanName = sanitizeForPdf(recipientName);
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(new PDRectangle(PDRectangle.LETTER.getHeight(), PDRectangle.LETTER.getWidth()));
            doc.addPage(page);
            float pageWidth = page.getMediaBox().getWidth();
            float pageHeight = page.getMediaBox().getHeight();

            PDFont bold = PDType1Font.HELVETICA_BOLD;
            PDFont italic = PDType1Font.HELVETICA_OBLIQUE;
            PDFont regular = PDType1Font.HELVETICA;
            PDFont script = PDType1Font.TIMES_ITALIC;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                // Double border frame
                cs.setStrokingColor(NAVY_R, NAVY_G, NAVY_B);
                cs.setLineWidth(3f);
                cs.addRect(24, 24, pageWidth - 48, pageHeight - 48);
                cs.stroke();
                cs.setLineWidth(1f);
                cs.addRect(32, 32, pageWidth - 64, pageHeight - 64);
                cs.stroke();

                float centerX = pageWidth / 2;
                float y = pageHeight - 110;

                y = centered(cs, bold, 16, NAVY_R, NAVY_G, NAVY_B, "VMLTS", centerX, y);
                y -= 20;
                y = centered(cs, italic, 11, 0.35f, 0.35f, 0.35f, "Virtual Market Learning & Trading Simulator", centerX, y);
                y -= 50;
                y = centered(cs, bold, 32, NAVY_R, NAVY_G, NAVY_B, "CERTIFICATE OF COMPLETION", centerX, y);
                y -= 45;
                y = centered(cs, italic, 13, 0.27f, 0.27f, 0.27f, "is hereby awarded to", centerX, y);
                y -= 55;
                y = centered(cs, script, 30, NAVY_R, NAVY_G, NAVY_B, cleanName, centerX, y);

                // underline beneath recipient name
                float nameWidth = script.getStringWidth(cleanName) / 1000 * 30;
                cs.setStrokingColor(NAVY_R, NAVY_G, NAVY_B);
                cs.setLineWidth(1f);
                cs.moveTo(centerX - nameWidth / 2 - 30, y - 8);
                cs.lineTo(centerX + nameWidth / 2 + 30, y - 8);
                cs.stroke();

                y -= 45;
                y = centered(cs, italic, 13, 0.27f, 0.27f, 0.27f, "for successfully completing the", centerX, y);
                y -= 30;
                y = centered(cs, bold, 20, NAVY_R, NAVY_G, NAVY_B, courseTitle, centerX, y);
                y -= 35;
                y = centered(cs, regular, 11, 0.33f, 0.33f, 0.33f,
                        "Awarded for demonstrating the knowledge, discipline, and skill required", centerX, y);
                y -= 16;
                y = centered(cs, regular, 11, 0.33f, 0.33f, 0.33f,
                        "to trade the forex markets with confidence.", centerX, y);

                // Footer: date left, signature right
                float footerY = 110;
                String dateStr = DateTimeFormatter.ofPattern("MMMM d, yyyy").withZone(ZoneOffset.UTC).format(Instant.now());

                float leftX = pageWidth * 0.28f;
                float rightX = pageWidth * 0.72f;

                cs.setStrokingColor(NAVY_R, NAVY_G, NAVY_B);
                cs.setLineWidth(1f);
                cs.moveTo(leftX - 90, footerY + 20);
                cs.lineTo(leftX + 90, footerY + 20);
                cs.stroke();
                centered(cs, regular, 12, NAVY_R, NAVY_G, NAVY_B, dateStr, leftX, footerY + 26);
                centered(cs, regular, 9, 0.4f, 0.4f, 0.4f, "Date Awarded", leftX, footerY + 4);

                cs.moveTo(rightX - 110, footerY + 20);
                cs.lineTo(rightX + 110, footerY + 20);
                cs.stroke();
                centered(cs, script, 18, NAVY_R, NAVY_G, NAVY_B, signerName, rightX, footerY + 26);
                centered(cs, regular, 9, 0.4f, 0.4f, 0.4f, "Director of Education, VMLTS", rightX, footerY + 4);

                centered(cs, bold, 9, GOLD_R, GOLD_G, GOLD_B, "VMLTS • EST. 2025", centerX, footerY + 14);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate certificate PDF", e);
        }
    }

    /** Draws text centered horizontally at centerX, baseline at y. Returns y (unchanged) for chaining. */
    private float centered(PDPageContentStream cs, PDFont font, float size,
                            float r, float g, float b, String text, float centerX, float y) throws IOException {
        float width = font.getStringWidth(text) / 1000 * size;
        cs.beginText();
        cs.setFont(font, size);
        cs.setNonStrokingColor(r, g, b);
        cs.newLineAtOffset(centerX - width / 2, y);
        cs.showText(text);
        cs.endText();
        return y;
    }

    // PDFBox's standard fonts (Helvetica, Times, etc.) only support WinAnsiEncoding — roughly
    // Latin-1. Emoji or other characters outside that range don't just render wrong, they
    // throw an exception and fail the whole PDF generation. Strip anything outside printable
    // Latin-1 (keeping letters, digits, spaces, and common name punctuation), collapse the
    // leftover whitespace, and fall back to a safe default if nothing usable remains — e.g.
    // "Alfred 😎" becomes "Alfred".
    private String sanitizeForPdf(String name) {
        if (name == null) return "VMLTS Learner";
        String stripped = name.replaceAll("[^\\x20-\\x7E\\xA0-\\xFF]", "");
        stripped = stripped.trim().replaceAll("\\s+", " ");
        return stripped.isEmpty() ? "VMLTS Learner" : stripped;
    }
}
