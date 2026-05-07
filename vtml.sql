
CREATE TABLE "user" (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT        NOT NULL,
    email            TEXT        NOT NULL UNIQUE,
    password_hash    TEXT        NOT NULL,
    risk_tier        TEXT        NOT NULL DEFAULT 'low'
                                 CHECK (risk_tier IN ('low', 'medium', 'high')),
    virtual_balance  NUMERIC(18, 4) NOT NULL DEFAULT 10000.00,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_email ON "user" (email);


CREATE TABLE lesson_module (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT        NOT NULL,
    content_json JSONB       NOT NULL DEFAULT '{}',
    quiz_json    JSONB       NOT NULL DEFAULT '{}',
    order_index  INT         NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_lesson_module_order ON lesson_module (order_index);



CREATE TABLE challenge (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT        NOT NULL,
    target_profit   NUMERIC(18, 4) NOT NULL,
    time_limit_mins INT         NOT NULL CHECK (time_limit_mins > 0),
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    CHECK (end_at > start_at)
);



CREATE TABLE trade (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    asset_symbol        TEXT        NOT NULL,
    type                TEXT        NOT NULL CHECK (type IN ('buy', 'sell')),
    quantity            NUMERIC(18, 8) NOT NULL CHECK (quantity > 0),
    price_at_execution  NUMERIC(18, 4) NOT NULL CHECK (price_at_execution >= 0),
    executed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'executed', 'cancelled')),
    challenge_id        UUID        REFERENCES challenge (id) ON DELETE SET NULL
);

CREATE INDEX idx_trade_user_id      ON trade (user_id);
CREATE INDEX idx_trade_asset_symbol ON trade (asset_symbol);
CREATE INDEX idx_trade_executed_at  ON trade (executed_at DESC);



CREATE TABLE portfolio (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    asset_symbol   TEXT        NOT NULL,
    quantity_held  NUMERIC(18, 8) NOT NULL DEFAULT 0,
    avg_buy_price  NUMERIC(18, 4) NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, asset_symbol)
);

CREATE INDEX idx_portfolio_user_id ON portfolio (user_id);




CREATE TABLE market_event (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    label          TEXT        NOT NULL,
    event_type     TEXT        NOT NULL,
    triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    magnitude      NUMERIC(10, 4) NOT NULL,
    duration_ticks INT         NOT NULL CHECK (duration_ticks > 0)
);

CREATE INDEX idx_market_event_triggered_at ON market_event (triggered_at DESC);
CREATE INDEX idx_market_event_type         ON market_event (event_type);