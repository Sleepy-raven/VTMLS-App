package com.vmlts.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AdminLessonRequest {
    private String title;
    private String content;
    private String duration;
    @JsonProperty("isPremium")
    private boolean isPremium;
    private int order;
}
