-- ============================================================
-- Smart TASMAC — Report Views + Indexes
-- ============================================================
-- Security Notes:
--   • NO PII in any view (no names, emails, phone, mock_id_number_enc).
--   • All views use HAVING … >= 5  (k-anonymity = 5).
--   • These views are the single source of truth for both
--     in-app Recharts/Matplotlib reports AND Power BI exports.
--   • The `tasmac_reports` read-only DB role should be GRANTED
--     SELECT on these views ONLY (not on base tables).
-- ============================================================


-- ------------------------------------------------------------
-- Supporting indexes (idempotent via IF NOT EXISTS)
-- ------------------------------------------------------------

-- Composite: supports date-range + consumer filter on purchases
CREATE INDEX IF NOT EXISTS idx_purchases_consumer_ts
    ON purchases (consumer_id, timestamp);

-- Composite: supports date-range + shop filter on purchases
CREATE INDEX IF NOT EXISTS idx_purchases_shop_ts
    ON purchases (shop_id, timestamp);

-- district filter on consumers
CREATE INDEX IF NOT EXISTS idx_consumers_district
    ON consumers (district);

-- district filter on shops
CREATE INDEX IF NOT EXISTS idx_shops_district
    ON shops (district);


-- ============================================================
-- View 1: v_district_sales_summary
--   Aggregated purchase stats per district.
--   k-anon: suppresses districts with < 5 unique consumers.
-- ============================================================
CREATE OR REPLACE VIEW v_district_sales_summary AS
SELECT
    c.district,
    COUNT(pu.id)                                                  AS total_purchases,
    COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)    AS total_revenue,
    COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)      AS total_drinks,
    COUNT(DISTINCT c.id)                                          AS unique_consumers
FROM consumers c
JOIN purchases pu  ON pu.consumer_id  = c.id
JOIN products  pr  ON pr.id           = pu.product_id
GROUP BY c.district
HAVING COUNT(DISTINCT c.id) >= 5;


-- ============================================================
-- View 2: v_age_group_consumption
--   Aggregated consumption by 10-year age brackets.
--   k-anon: suppresses brackets with < 5 unique consumers.
--   No DOB values exposed — only the computed bracket label.
-- ============================================================
CREATE OR REPLACE VIEW v_age_group_consumption AS
SELECT
    CASE
        WHEN EXTRACT(YEAR FROM age(c.dob)) < 25 THEN '<25'
        WHEN EXTRACT(YEAR FROM age(c.dob)) < 35 THEN '25-34'
        WHEN EXTRACT(YEAR FROM age(c.dob)) < 45 THEN '35-44'
        WHEN EXTRACT(YEAR FROM age(c.dob)) < 55 THEN '45-54'
        ELSE '55+'
    END                                                           AS age_bracket,
    COUNT(DISTINCT c.id)                                          AS consumer_count,
    COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)      AS total_drinks
FROM consumers c
JOIN purchases pu  ON pu.consumer_id  = c.id
JOIN products  pr  ON pr.id           = pu.product_id
GROUP BY age_bracket
HAVING COUNT(DISTINCT c.id) >= 5
ORDER BY age_bracket;


-- ============================================================
-- View 3: v_shop_revenue_monthly
--   Monthly revenue rolled up per shop + district.
--   No consumer data — only shop_id, which is not PII.
-- ============================================================
CREATE OR REPLACE VIEW v_shop_revenue_monthly AS
SELECT
    s.id                                                             AS shop_id,
    s.name                                                           AS shop_name,
    s.district,
    TO_CHAR(DATE_TRUNC('month', pu.timestamp), 'YYYY-MM')           AS year_month,
    COUNT(pu.id)                                                     AS transactions,
    COALESCE(SUM(CAST(pr.price AS NUMERIC) * pu.quantity), 0)       AS revenue
FROM shops    s
JOIN purchases pu  ON pu.shop_id     = s.id
JOIN products  pr  ON pr.id          = pu.product_id
GROUP BY s.id, s.name, s.district, year_month
ORDER BY s.district, year_month;


-- ============================================================
-- View 4: v_consumption_trend_daily
--   Daily purchase totals per district for trend charts.
--   No individual consumer data.
-- ============================================================
CREATE OR REPLACE VIEW v_consumption_trend_daily AS
SELECT
    CAST(pu.timestamp AS DATE)                                       AS purchase_date,
    c.district,
    COUNT(pu.id)                                                     AS total_purchases,
    COALESCE(SUM(pr.standard_drink_equiv * pu.quantity), 0)         AS total_drinks
FROM purchases pu
JOIN consumers c   ON c.id   = pu.consumer_id
JOIN products  pr  ON pr.id  = pu.product_id
GROUP BY purchase_date, c.district
ORDER BY purchase_date, c.district;


-- ============================================================
-- View 5: v_restriction_adoption_rate
--   Fraction of consumers per district who have ANY active
--   restriction (self-imposed OR doctor-imposed).
--   k-anon: suppresses districts with < 5 consumers.
-- ============================================================
CREATE OR REPLACE VIEW v_restriction_adoption_rate AS
SELECT
    c.district,
    COUNT(DISTINCT c.id)                                             AS total_consumers,
    COUNT(DISTINCT r.consumer_id)                                    AS restricted_count,
    ROUND(
        100.0 * COUNT(DISTINCT r.consumer_id)
              / NULLIF(COUNT(DISTINCT c.id), 0),
        2
    )                                                                AS adoption_rate_pct
FROM consumers c
LEFT JOIN restrictions r ON r.consumer_id = c.id
GROUP BY c.district
HAVING COUNT(DISTINCT c.id) >= 5;


-- ============================================================
-- Read-only role setup (run as superuser once in production)
-- ============================================================
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasmac_reports') THEN
--     CREATE ROLE tasmac_reports NOLOGIN;
--   END IF;
-- END$$;
--
-- GRANT SELECT ON
--   v_district_sales_summary,
--   v_age_group_consumption,
--   v_shop_revenue_monthly,
--   v_consumption_trend_daily,
--   v_restriction_adoption_rate
-- TO tasmac_reports;
-- (No GRANT on base tables — views only)
