package com.vmlts.dto;

import lombok.Data;

@Data
public class OpenTradeRequest {
    private String symbol;
    private String type;
    private double lotSize;
    private Double stopLoss;
    private Double takeProfit;
}
