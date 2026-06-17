package com.vmlts.dto;

import lombok.Data;

@Data
public class AdminUserUpdateRequest {
    private String tier;
    private Boolean isPremium;
}
