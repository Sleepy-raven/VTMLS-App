package com.vmlts.dto;

import lombok.Data;

@Data
public class LessonProgressRequest {
    private Integer progress;
    private Boolean completed;
    private Integer score;
}
