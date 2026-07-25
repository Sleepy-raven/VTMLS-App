package com.vmlts.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@Slf4j
public class NewsService {

    @Value("${finnhub.api.key}")
    private String apiKey;

    @Value("${fcsapi.key}")
    private String fcsApiKey;

    private final OkHttpClient http = new OkHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    private static final Map<String, String> FINNHUB_CAT = Map.of(
            "Forex", "forex", "Gold", "forex", "Indices", "general",
            "Oil", "general", "Crypto", "crypto", "All", "forex"
    );

    public Map<String, Object> getNews(String categoryFilter) throws Exception {
        String cat = (categoryFilter != null && FINNHUB_CAT.containsKey(categoryFilter))
                ? FINNHUB_CAT.get(categoryFilter) : "forex";

        List<Map<String, Object>> news = fetchNews(cat);

        if (categoryFilter != null && !categoryFilter.equals("All")) {
            String filter = categoryFilter;
            news = news.stream().filter(n -> filter.equals(n.get("category"))).toList();
        }
        return Map.of("news", news.stream().limit(15).toList());
    }

    public Map<String, Object> getPremiumNews() throws Exception {
        List<Map<String, Object>> forex = fetchNews("forex");
        List<Map<String, Object>> crypto = fetchNews("crypto");
        List<Map<String, Object>> combined = new ArrayList<>();
        combined.addAll(forex);
        combined.addAll(crypto);
        return Map.of("news", combined.stream().limit(20).toList());
    }

 public Map<String, Object> getCalendar() throws Exception {
        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate weekAhead = today.plusDays(7);
        String url = "https://fcsapi.com/api-v3/forex/economy_cal?from=" + today + "&to=" + weekAhead
                + "&access_key=" + fcsApiKey;
        Request req = new Request.Builder().url(url).build();
        List<Map<String, Object>> events = new ArrayList<>();
        try (Response res = http.newCall(req).execute()) {
            JsonNode root = mapper.readTree(res.body().string());
            JsonNode arr = root.get("response");
            if (arr != null && arr.isArray()) {
                for (JsonNode item : arr) {
                    Map<String, Object> e = new LinkedHashMap<>();
                    e.put("id",       item.path("id").asText());
                    e.put("country",  item.path("country").asText());
                    e.put("event",    item.path("title").asText());
                    e.put("dateTime", item.path("date").asText().replace(" ", "T"));
                    e.put("impact",   mapImportance(item.path("importance").asText()));
                    e.put("actual",   item.path("actual").asText());
                    e.put("forecast", item.path("forecast").asText());
                    e.put("previous", item.path("previous").asText());
                    events.add(e);
                }
            }
        }
        return Map.of("calendar", events);
    }

    private String mapImportance(String importance) {
        return switch (importance) {
            case "3" -> "High";
            case "2" -> "Medium";
            case "1" -> "Low";
            default -> "Holiday";
        };
    }

    private List<Map<String, Object>> fetchNews(String category) throws Exception {
        String url = "https://finnhub.io/api/v1/news?category=" + category + "&token=" + apiKey;
        Request req = new Request.Builder().url(url).build();
        try (Response res = http.newCall(req).execute()) {
            JsonNode arr = mapper.readTree(res.body().string());
            List<Map<String, Object>> result = new ArrayList<>();
            for (JsonNode item : arr) {
                Map<String, Object> n = new LinkedHashMap<>();
                n.put("id", item.get("id").asLong());
                n.put("headline", item.get("headline").asText());
                n.put("summary", item.get("summary").asText());
                n.put("source", item.get("source").asText());
                n.put("url", item.get("url").asText());
                n.put("image", item.get("image").asText());
                n.put("time", timeAgo(item.get("datetime").asLong()));
                n.put("category", inferCategory(item.get("headline").asText()));
                result.add(n);
            }
            return result;
        }
    }

    private String inferCategory(String headline) {
        String h = headline.toLowerCase();
        if (h.contains("gold") || h.contains("xau")) return "Gold";
        if (h.contains("oil") || h.contains("crude")) return "Oil";
        if (h.contains("nasdaq") || h.contains("s&p") || h.contains("dow") || h.contains("index")) return "Indices";
        if (h.contains("bitcoin") || h.contains("crypto") || h.contains("eth")) return "Crypto";
        return "Forex";
    }

    private String timeAgo(long unixSeconds) {
        long diff = (System.currentTimeMillis() / 1000) - unixSeconds;
        if (diff < 60) return diff + "s ago";
        if (diff < 3600) return (diff / 60) + "m ago";
        if (diff < 86400) return (diff / 3600) + "h ago";
        return (diff / 86400) + "d ago";
    }
}