package com.vmlts.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AdminChallengeRequest {
    private String title;
    private String reward;
    private String cashPrize;
    @JsonProperty("isPremium")
    private boolean isPremium;
    private int total;
}
