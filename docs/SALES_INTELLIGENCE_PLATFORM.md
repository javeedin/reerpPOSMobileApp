# Sales Intelligence Platform - Technical Design Document

**Project:** FCPos Mobile App - Analytics Module
**Version:** 1.0
**Date:** December 2025
**Author:** Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Requirements](#2-business-requirements)
3. [Architecture Options](#3-architecture-options)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Mobile App Structure](#6-mobile-app-structure)
7. [AI & Predictions](#7-ai--predictions)
8. [Implementation Phases](#8-implementation-phases)
9. [Performance Considerations](#9-performance-considerations)
10. [Technical Specifications](#10-technical-specifications)

---

## 1. Executive Summary

### 1.1 Project Overview

Build a comprehensive Sales Intelligence Platform within the FCPos mobile application that provides:

- Real-time and historical sales analytics
- Performance tracking for shops, salesreps, products, and customers
- Trend analysis and comparisons (daily, weekly, monthly, yearly)
- AI-powered predictions and recommendations
- Customer churn analysis and retention insights

### 1.2 Data Scope

- **Historical Data:** 1+ years of sales transactions
- **Entities:** Shops, Salesreps, Items/Products, Customers, Brands
- **Metrics:** Sales, Orders, Discounts, Gross/Net Revenue, Quantities

### 1.3 Key Success Criteria

- Fast data access on mobile (< 2 seconds load time)
- Accurate trend calculations
- Actionable insights and predictions
- Easy-to-understand visualizations

---

## 2. Business Requirements

### 2.1 Dashboard & KPIs

| KPI | Description | Calculation |
|-----|-------------|-------------|
| Total Sales | Sum of net revenue | SUM(total_net) |
| Total Orders | Count of orders | COUNT(order_id) |
| Average Order Value | Revenue per order | Total Sales / Total Orders |
| Customer Count | Unique customers | COUNT(DISTINCT customer) |
| New Customers | First-time buyers | Customers with first_order_date in period |
| Repeat Customers | Returning buyers | Total Customers - New Customers |
| Growth Rate | Period-over-period change | (Current - Previous) / Previous * 100 |

### 2.2 Analytics Categories

#### Time-Based Analytics
- Daily sales summary
- Weekly comparisons (this week vs last week)
- Monthly trends (12-month rolling)
- Year-over-Year (YoY) comparisons
- Seasonal patterns

#### Entity-Based Analytics
- **Shops:** Revenue by shop, shop comparisons, best/worst performers
- **Salesreps:** Individual performance, rankings, target vs actual
- **Products:** Item movement, brand performance, slow/fast movers
- **Customers:** Purchase frequency, lifetime value, churn risk

#### Trend Analysis
- Moving averages (7-day, 30-day)
- Growth rates and trajectories
- Seasonality detection
- Anomaly detection

#### Churn Analysis
- Customer retention rate
- Days since last purchase
- Purchase frequency decline
- Product switching patterns

---

## 3. Architecture Options

### 3.1 Option A: Server-Side Pre-Aggregation (RECOMMENDED)

```
┌──────────────────┐     ┌─────────────────────────────────┐     ┌──────────────┐
│  Raw Orders      │     │  Oracle Database                │     │  Mobile App  │
│  (1M+ rows)      │ ──> │  ┌─────────────────────────┐   │ ──> │  (Fast!)     │
│                  │     │  │ Pre-aggregated Tables   │   │     │              │
│  - order_header  │     │  │ - daily_summary         │   │     │  Fetches     │
│  - order_lines   │     │  │ - weekly_summary        │   │     │  pre-computed│
│  - payments      │     │  │ - monthly_summary       │   │     │  data        │
│                  │     │  │ - customer_summary      │   │     │              │
└──────────────────┘     │  │ - product_summary       │   │     └──────────────┘
                         │  └─────────────────────────┘   │
                         │                                 │
                         │  Nightly Batch Jobs            │
                         │  - Refresh summaries           │
                         │  - Calculate predictions       │
                         └─────────────────────────────────┘
```

**Advantages:**
- Blazing fast mobile performance
- Handles millions of records
- Complex calculations done server-side
- Leverages Oracle's analytics capabilities

**Disadvantages:**
- Requires backend development
- Data is not real-time (daily refresh)

### 3.2 Option B: Hybrid Approach

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
│  Oracle DB      │     │  REST APIs      │     │  Mobile App                 │
│  (Summaries)    │ ──> │  /analytics/*   │ ──> │  ┌─────────────────────┐   │
│                 │     │                 │     │  │ SQLite Local Cache  │   │
│                 │     │                 │     │  │ - Cached summaries  │   │
│                 │     │                 │     │  │ - Offline access    │   │
│                 │     │                 │     │  └─────────────────────┘   │
└─────────────────┘     └─────────────────┘     └─────────────────────────────┘
```

**Use Cases:**
- Cache historical summaries locally
- Fetch only today's data in real-time
- Work offline with cached data

### 3.3 Recommendation

**Use Option A (Server-Side) for:**
- Historical analytics (past months/years)
- Complex calculations (churn, predictions)
- Large dataset aggregations

**Use Option B (Hybrid) for:**
- Today's real-time data
- Offline capability
- Frequently accessed KPIs

---

## 4. Database Design

### 4.1 Summary Tables Schema

#### 4.1.1 Daily Sales Summary

```sql
CREATE TABLE sales_daily_summary (
    summary_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    summary_date        DATE NOT NULL,
    shop_code           VARCHAR2(20),
    salesrep_code       VARCHAR2(20),

    -- Order Metrics
    total_orders        NUMBER DEFAULT 0,
    total_lines         NUMBER DEFAULT 0,

    -- Financial Metrics
    total_gross         NUMBER(15,2) DEFAULT 0,
    total_discount      NUMBER(15,2) DEFAULT 0,
    total_tax           NUMBER(15,2) DEFAULT 0,
    total_net           NUMBER(15,2) DEFAULT 0,

    -- Customer Metrics
    total_customers     NUMBER DEFAULT 0,
    new_customers       NUMBER DEFAULT 0,
    repeat_customers    NUMBER DEFAULT 0,

    -- Calculated Metrics
    avg_order_value     NUMBER(15,2),
    avg_items_per_order NUMBER(10,2),

    -- Metadata
    created_date        DATE DEFAULT SYSDATE,
    last_updated        DATE DEFAULT SYSDATE,

    CONSTRAINT uk_daily_summary UNIQUE (summary_date, shop_code, salesrep_code)
);

CREATE INDEX idx_daily_summary_date ON sales_daily_summary(summary_date);
CREATE INDEX idx_daily_summary_shop ON sales_daily_summary(shop_code);
CREATE INDEX idx_daily_summary_rep ON sales_daily_summary(salesrep_code);
```

#### 4.1.2 Product Daily Summary

```sql
CREATE TABLE product_daily_summary (
    summary_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    summary_date        DATE NOT NULL,
    item_code           VARCHAR2(50) NOT NULL,
    item_description    VARCHAR2(200),
    brand               VARCHAR2(100),
    category            VARCHAR2(100),

    -- Sales Metrics
    qty_sold            NUMBER DEFAULT 0,
    total_revenue       NUMBER(15,2) DEFAULT 0,
    total_discount      NUMBER(15,2) DEFAULT 0,

    -- Price Metrics
    avg_selling_price   NUMBER(15,2),
    min_selling_price   NUMBER(15,2),
    max_selling_price   NUMBER(15,2),

    -- Order Metrics
    order_count         NUMBER DEFAULT 0,
    customer_count      NUMBER DEFAULT 0,

    -- Metadata
    created_date        DATE DEFAULT SYSDATE,

    CONSTRAINT uk_product_daily UNIQUE (summary_date, item_code)
);

CREATE INDEX idx_product_daily_date ON product_daily_summary(summary_date);
CREATE INDEX idx_product_daily_brand ON product_daily_summary(brand);
```

#### 4.1.3 Customer Summary

```sql
CREATE TABLE customer_summary (
    customer_id         NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_code       VARCHAR2(50) NOT NULL UNIQUE,
    customer_name       VARCHAR2(200),

    -- Purchase History
    first_purchase_date DATE,
    last_purchase_date  DATE,
    total_orders        NUMBER DEFAULT 0,
    total_spent         NUMBER(15,2) DEFAULT 0,

    -- Averages
    avg_order_value     NUMBER(15,2),
    avg_days_between_orders NUMBER,

    -- Recency Metrics
    days_since_last_order NUMBER,

    -- Churn Analysis
    churn_risk          VARCHAR2(10),  -- HIGH, MEDIUM, LOW
    churn_score         NUMBER(5,2),   -- 0-100

    -- Preferences
    favorite_brand      VARCHAR2(100),
    favorite_category   VARCHAR2(100),
    preferred_shop      VARCHAR2(20),
    preferred_salesrep  VARCHAR2(20),

    -- Segmentation
    customer_segment    VARCHAR2(50),  -- VIP, Regular, Occasional, At-Risk
    lifetime_value      NUMBER(15,2),

    -- Metadata
    created_date        DATE DEFAULT SYSDATE,
    last_updated        DATE DEFAULT SYSDATE
);

CREATE INDEX idx_customer_churn ON customer_summary(churn_risk);
CREATE INDEX idx_customer_segment ON customer_summary(customer_segment);
```

#### 4.1.4 Weekly Summary (Materialized View)

```sql
CREATE MATERIALIZED VIEW sales_weekly_summary
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
SELECT
    TRUNC(summary_date, 'IW') AS week_start_date,
    shop_code,
    salesrep_code,
    SUM(total_orders) AS total_orders,
    SUM(total_gross) AS total_gross,
    SUM(total_discount) AS total_discount,
    SUM(total_net) AS total_net,
    SUM(total_customers) AS total_customers,
    SUM(new_customers) AS new_customers,
    ROUND(SUM(total_net) / NULLIF(SUM(total_orders), 0), 2) AS avg_order_value
FROM sales_daily_summary
GROUP BY TRUNC(summary_date, 'IW'), shop_code, salesrep_code;
```

#### 4.1.5 Monthly Summary (Materialized View)

```sql
CREATE MATERIALIZED VIEW sales_monthly_summary
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
SELECT
    TRUNC(summary_date, 'MM') AS month_start_date,
    TO_CHAR(summary_date, 'YYYY-MM') AS year_month,
    shop_code,
    salesrep_code,
    SUM(total_orders) AS total_orders,
    SUM(total_gross) AS total_gross,
    SUM(total_discount) AS total_discount,
    SUM(total_net) AS total_net,
    SUM(total_customers) AS total_customers,
    SUM(new_customers) AS new_customers,
    ROUND(SUM(total_net) / NULLIF(SUM(total_orders), 0), 2) AS avg_order_value,
    -- YoY Comparison will be calculated in queries
    COUNT(DISTINCT summary_date) AS days_in_period
FROM sales_daily_summary
GROUP BY TRUNC(summary_date, 'MM'), TO_CHAR(summary_date, 'YYYY-MM'), shop_code, salesrep_code;
```

### 4.2 Batch Job for Daily Summary

```sql
CREATE OR REPLACE PROCEDURE refresh_daily_summary(p_date DATE DEFAULT SYSDATE - 1) AS
BEGIN
    -- Delete existing data for the date
    DELETE FROM sales_daily_summary WHERE summary_date = TRUNC(p_date);

    -- Insert aggregated data
    INSERT INTO sales_daily_summary (
        summary_date, shop_code, salesrep_code,
        total_orders, total_lines, total_gross, total_discount, total_tax, total_net,
        total_customers, new_customers, repeat_customers,
        avg_order_value, avg_items_per_order
    )
    SELECT
        TRUNC(o.order_date) AS summary_date,
        o.shop_code,
        o.salesrep_code,
        COUNT(DISTINCT o.order_id) AS total_orders,
        COUNT(ol.line_id) AS total_lines,
        SUM(ol.gross_amount) AS total_gross,
        SUM(ol.discount_amount) AS total_discount,
        SUM(ol.tax_amount) AS total_tax,
        SUM(ol.net_amount) AS total_net,
        COUNT(DISTINCT o.customer_code) AS total_customers,
        -- New customers calculation (first order ever)
        COUNT(DISTINCT CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM orders prev
                WHERE prev.customer_code = o.customer_code
                AND prev.order_date < TRUNC(p_date)
            ) THEN o.customer_code
        END) AS new_customers,
        -- Repeat customers
        COUNT(DISTINCT CASE
            WHEN EXISTS (
                SELECT 1 FROM orders prev
                WHERE prev.customer_code = o.customer_code
                AND prev.order_date < TRUNC(p_date)
            ) THEN o.customer_code
        END) AS repeat_customers,
        ROUND(SUM(ol.net_amount) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS avg_order_value,
        ROUND(COUNT(ol.line_id) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2) AS avg_items_per_order
    FROM orders o
    JOIN order_lines ol ON o.order_id = ol.order_id
    WHERE TRUNC(o.order_date) = TRUNC(p_date)
    GROUP BY TRUNC(o.order_date), o.shop_code, o.salesrep_code;

    COMMIT;

    -- Log completion
    DBMS_OUTPUT.PUT_LINE('Daily summary refreshed for: ' || TO_CHAR(p_date, 'YYYY-MM-DD'));
END;
/
```

### 4.3 Scheduled Job

```sql
-- Create a scheduler job to run nightly at 2 AM
BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'REFRESH_DAILY_SUMMARY_JOB',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN refresh_daily_summary(SYSDATE - 1); END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY; BYHOUR=2; BYMINUTE=0; BYSECOND=0',
        enabled         => TRUE,
        comments        => 'Refresh daily sales summary every night at 2 AM'
    );
END;
/
```

---

## 5. API Design

### 5.1 REST API Endpoints

#### 5.1.1 Dashboard KPIs

```
GET /analytics/dashboard/kpis
Parameters:
  - period: today | week | month | year
  - shop_code: (optional) filter by shop
  - salesrep_code: (optional) filter by salesrep

Response:
{
    "period": "month",
    "current": {
        "total_sales": 1250000,
        "total_orders": 3500,
        "avg_order_value": 357.14,
        "total_customers": 850,
        "new_customers": 120
    },
    "previous": {
        "total_sales": 1100000,
        "total_orders": 3200,
        "avg_order_value": 343.75,
        "total_customers": 780,
        "new_customers": 95
    },
    "growth": {
        "sales_growth": 13.64,
        "orders_growth": 9.38,
        "customers_growth": 8.97
    }
}
```

#### 5.1.2 Sales Trends

```
GET /analytics/trends/sales
Parameters:
  - from_date: YYYY-MM-DD
  - to_date: YYYY-MM-DD
  - granularity: daily | weekly | monthly
  - shop_code: (optional)

Response:
{
    "granularity": "daily",
    "data": [
        { "date": "2025-12-01", "sales": 45000, "orders": 125, "customers": 80 },
        { "date": "2025-12-02", "sales": 52000, "orders": 140, "customers": 95 },
        ...
    ],
    "summary": {
        "total_sales": 1250000,
        "avg_daily_sales": 41666.67,
        "peak_day": "2025-12-15",
        "peak_sales": 85000
    }
}
```

#### 5.1.3 Shop Performance

```
GET /analytics/performance/shops
Parameters:
  - period: week | month | year
  - sort_by: sales | orders | growth
  - limit: number of shops to return

Response:
{
    "period": "month",
    "shops": [
        {
            "shop_code": "SHOP001",
            "shop_name": "Main Store",
            "total_sales": 450000,
            "total_orders": 1200,
            "growth_rate": 15.5,
            "rank": 1,
            "avg_order_value": 375.00,
            "top_salesrep": "REP001"
        },
        ...
    ],
    "comparison": {
        "best_performer": "SHOP001",
        "worst_performer": "SHOP005",
        "average_sales": 250000
    }
}
```

#### 5.1.4 Salesrep Performance

```
GET /analytics/performance/salesreps
Parameters:
  - period: week | month | year
  - shop_code: (optional)

Response:
{
    "salesreps": [
        {
            "salesrep_code": "REP001",
            "salesrep_name": "John Doe",
            "shop_code": "SHOP001",
            "total_sales": 180000,
            "total_orders": 450,
            "total_customers": 120,
            "new_customers": 25,
            "avg_order_value": 400.00,
            "growth_rate": 12.5,
            "rank": 1
        },
        ...
    ]
}
```

#### 5.1.5 Product Analytics

```
GET /analytics/products
Parameters:
  - period: week | month | year
  - brand: (optional)
  - category: (optional)
  - sort_by: revenue | quantity | growth

Response:
{
    "products": [
        {
            "item_code": "ITEM001",
            "item_name": "Product A",
            "brand": "Brand X",
            "category": "Electronics",
            "qty_sold": 500,
            "revenue": 75000,
            "avg_price": 150.00,
            "growth_rate": 20.5,
            "rank": 1
        },
        ...
    ],
    "brands_summary": [
        { "brand": "Brand X", "revenue": 250000, "market_share": 35.5 },
        ...
    ]
}
```

#### 5.1.6 Customer Analytics

```
GET /analytics/customers
Parameters:
  - segment: all | vip | regular | at-risk | churned
  - limit: number

Response:
{
    "summary": {
        "total_customers": 2500,
        "active_customers": 2100,
        "at_risk_customers": 280,
        "churned_customers": 120,
        "retention_rate": 84.0
    },
    "segments": [
        { "segment": "VIP", "count": 150, "revenue_share": 45.0 },
        { "segment": "Regular", "count": 1200, "revenue_share": 40.0 },
        { "segment": "Occasional", "count": 750, "revenue_share": 12.0 },
        { "segment": "At-Risk", "count": 280, "revenue_share": 3.0 }
    ],
    "churn_analysis": {
        "churn_rate": 4.8,
        "avg_lifetime_value": 12500,
        "avg_orders_before_churn": 8
    }
}
```

#### 5.1.7 AI Predictions

```
GET /analytics/predictions
Parameters:
  - type: sales | demand | churn

Response:
{
    "predictions": {
        "next_month_sales": {
            "predicted": 1350000,
            "confidence": 85,
            "range_low": 1250000,
            "range_high": 1450000
        },
        "top_growing_products": [
            { "item_code": "ITEM005", "predicted_growth": 35.0 },
            ...
        ],
        "churn_risk_customers": [
            { "customer_code": "CUST100", "risk_score": 85, "last_order_days": 45 },
            ...
        ]
    }
}
```

---

## 6. Mobile App Structure

### 6.1 Navigation Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BOTTOM TABS                                  │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│  Home    │   You    │  Orders  │ Inventory│   Menu   │  Analytics   │
│          │          │          │          │          │   (NEW)      │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘

Analytics Tab Structure:
├── Analytics Dashboard (Home)
│   ├── KPI Cards
│   ├── Quick Stats
│   └── Trend Mini-Chart
│
├── Shop Performance
│   ├── Shop List/Rankings
│   ├── Shop Detail View
│   └── Shop Comparison
│
├── Salesrep Performance
│   ├── Salesrep List/Rankings
│   ├── Individual Performance
│   └── Leaderboard
│
├── Product Analytics
│   ├── Top Products
│   ├── Brand Performance
│   ├── Slow/Fast Movers
│   └── Product Trends
│
├── Customer Analytics
│   ├── Customer Segments
│   ├── Churn Analysis
│   ├── Customer Detail
│   └── Retention Metrics
│
├── Trends & Compare
│   ├── Time-based Trends
│   ├── Period Comparisons
│   └── YoY Analysis
│
└── AI Insights
    ├── Sales Predictions
    ├── Demand Forecast
    ├── Churn Alerts
    └── Recommendations
```

### 6.2 Screen Wireframes

#### 6.2.1 Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Analytics                                    [Filter] [📅]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           This Month Performance                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │  $1.25M     │  │   3,500     │  │    850      │       │   │
│  │  │  Total Sales│  │   Orders    │  │  Customers  │       │   │
│  │  │  ▲ +13.6%   │  │  ▲ +9.4%    │  │  ▲ +8.9%    │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Sales Trend (Last 30 Days)                              │   │
│  │  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁                          │   │
│  │  $42K avg/day                                Peak: $85K  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Quick Access                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ 🏪 Shops   │ │ 👤 Reps    │ │ 📦 Products│ │ 👥 Customers│   │
│  │ Performance│ │ Rankings   │ │ Analytics  │ │ Insights   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
│  ┌────────────┐ ┌────────────┐                                  │
│  │ 📈 Trends  │ │ 🤖 AI      │                                  │
│  │ & Compare  │ │ Predictions│                                  │
│  └────────────┘ └────────────┘                                  │
│                                                                  │
│  Top Performers This Month                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 🥇 Shop A - $450K  │ 🥇 John D - $180K  │ 🥇 Item X - 500 │   │
│  │ 🥈 Shop B - $380K  │ 🥈 Jane S - $165K  │ 🥈 Item Y - 420 │   │
│  │ 🥉 Shop C - $320K  │ 🥉 Bob M - $145K   │ 🥉 Item Z - 380 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.2 Shop Performance Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Shop Performance                              [This Month ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  All Shops Summary                                        │   │
│  │  Total: $1.25M  │  Avg: $250K  │  Best Growth: Shop A    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Rankings                                    [By Sales ▼]        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 🥇 1. Shop A                                              │   │
│  │    $450,000  │  1,200 orders  │  ▲ 15.5%                 │   │
│  │    ████████████████████████████████░░░░░░  (36%)         │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🥈 2. Shop B                                              │   │
│  │    $380,000  │  980 orders    │  ▲ 8.2%                  │   │
│  │    ███████████████████████████░░░░░░░░░░░  (30%)         │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🥉 3. Shop C                                              │   │
│  │    $320,000  │  850 orders    │  ▲ 5.1%                  │   │
│  │    ██████████████████████░░░░░░░░░░░░░░░░  (26%)         │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │    4. Shop D                                              │   │
│  │    $100,000  │  470 orders    │  ▼ -2.3%                 │   │
│  │    ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (8%)          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Compare Shops]                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Required Libraries

```json
{
  "dependencies": {
    "react-native-chart-kit": "^6.12.0",
    "victory-native": "^36.6.0",
    "react-native-svg": "^13.0.0",
    "react-native-progress": "^5.0.0"
  }
}
```

---

## 7. AI & Predictions

### 7.1 Prediction Types

#### 7.1.1 Sales Forecasting

**Method:** Weighted Moving Average + Seasonality

```javascript
const predictNextMonth = (historicalData) => {
  // Last 3 months weighted average (recent months weighted higher)
  const weights = [0.5, 0.3, 0.2]; // Most recent = 50%
  const last3Months = historicalData.slice(-3);

  let weightedSum = 0;
  for (let i = 0; i < 3; i++) {
    weightedSum += last3Months[i].sales * weights[i];
  }

  // Same month last year (seasonality adjustment)
  const sameMonthLastYear = historicalData.find(
    d => d.month === targetMonth && d.year === currentYear - 1
  );

  // Growth trend
  const growthRate = calculateGrowthTrend(historicalData);

  // Blend: 60% recent trend + 40% seasonality
  const prediction = (weightedSum * 0.6) +
                     (sameMonthLastYear.sales * (1 + growthRate) * 0.4);

  return {
    predicted: prediction,
    confidence: calculateConfidence(historicalData),
    range_low: prediction * 0.92,
    range_high: prediction * 1.08
  };
};
```

#### 7.1.2 Churn Risk Scoring

**Method:** Rule-based scoring with multiple factors

```javascript
const calculateChurnRisk = (customer) => {
  let score = 0;

  // Factor 1: Days since last order (0-40 points)
  if (customer.daysSinceLastOrder > 90) score += 40;
  else if (customer.daysSinceLastOrder > 60) score += 30;
  else if (customer.daysSinceLastOrder > 30) score += 15;

  // Factor 2: Order frequency decline (0-30 points)
  const frequencyDecline = calculateFrequencyDecline(customer);
  if (frequencyDecline > 50) score += 30;
  else if (frequencyDecline > 25) score += 20;
  else if (frequencyDecline > 10) score += 10;

  // Factor 3: Basket size decline (0-20 points)
  const basketDecline = calculateBasketDecline(customer);
  if (basketDecline > 30) score += 20;
  else if (basketDecline > 15) score += 10;

  // Factor 4: No engagement with new products (0-10 points)
  if (!customer.triedNewProducts) score += 10;

  // Risk classification
  let risk = 'LOW';
  if (score >= 70) risk = 'HIGH';
  else if (score >= 40) risk = 'MEDIUM';

  return { score, risk };
};
```

#### 7.1.3 Demand Prediction

**Method:** Historical average with trend adjustment

```javascript
const predictDemand = (product, period) => {
  // Historical average for same period
  const historicalAvg = calculateHistoricalAverage(product, period);

  // Recent trend (last 3 periods)
  const recentTrend = calculateRecentTrend(product);

  // Seasonal adjustment
  const seasonalFactor = getSeasonalFactor(product, period);

  // Prediction
  const predicted = historicalAvg * (1 + recentTrend) * seasonalFactor;

  return {
    product: product.code,
    predicted_qty: Math.round(predicted),
    trend: recentTrend > 0 ? 'UP' : 'DOWN',
    confidence: calculateConfidence(product)
  };
};
```

### 7.2 Oracle ML Integration (Advanced)

For more sophisticated predictions, Oracle Database has built-in ML capabilities:

```sql
-- Create a forecasting model
BEGIN
    DBMS_DATA_MINING.CREATE_MODEL(
        model_name          => 'SALES_FORECAST_MODEL',
        mining_function     => DBMS_DATA_MINING.TIME_SERIES,
        data_table_name     => 'sales_monthly_summary',
        case_id_column_name => 'year_month',
        target_column_name  => 'total_net'
    );
END;
/

-- Get predictions
SELECT * FROM TABLE(
    DBMS_DATA_MINING.TIME_SERIES_FORECAST(
        'SALES_FORECAST_MODEL',
        12  -- Forecast 12 months ahead
    )
);
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Objective:** Set up database infrastructure and basic APIs

**Tasks:**
- [ ] Create summary tables in Oracle
- [ ] Build batch job procedures
- [ ] Set up nightly scheduler
- [ ] Create basic REST APIs
- [ ] Add Analytics tab placeholder in app

**Deliverables:**
- Database schema deployed
- Daily summary population working
- 3-4 basic API endpoints

### Phase 2: Core Dashboards (Weeks 3-4)

**Objective:** Build main analytics screens

**Tasks:**
- [ ] Analytics Dashboard screen
- [ ] KPI cards component
- [ ] Shop Performance screen
- [ ] Salesrep Performance screen
- [ ] Basic trend charts

**Deliverables:**
- Working dashboard with real data
- Shop and salesrep rankings
- Simple line charts for trends

### Phase 3: Deep Analytics (Weeks 5-6)

**Objective:** Product and customer analytics

**Tasks:**
- [ ] Product Analytics screen
- [ ] Brand performance views
- [ ] Customer Analytics screen
- [ ] Churn risk calculation
- [ ] Customer segmentation

**Deliverables:**
- Product/brand insights
- Customer segments
- Churn risk indicators

### Phase 4: Comparisons & Trends (Week 7)

**Objective:** Time-based analysis features

**Tasks:**
- [ ] Period comparison screen
- [ ] YoY analysis
- [ ] Weekly trends
- [ ] Monthly trends
- [ ] Filter capabilities

**Deliverables:**
- Compare any two periods
- YoY growth calculations
- Multi-period trend views

### Phase 5: AI & Predictions (Week 8)

**Objective:** Predictive analytics

**Tasks:**
- [ ] Sales forecasting logic
- [ ] Churn prediction
- [ ] Demand forecasting
- [ ] AI Insights screen
- [ ] Alert/notification system

**Deliverables:**
- Working predictions
- Confidence scores
- Actionable recommendations

---

## 9. Performance Considerations

### 9.1 Database Optimization

```sql
-- Partition large tables by date
ALTER TABLE order_header
PARTITION BY RANGE (order_date)
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(PARTITION p_initial VALUES LESS THAN (DATE '2024-01-01'));

-- Create appropriate indexes
CREATE INDEX idx_orders_date_shop ON order_header(order_date, shop_code);
CREATE INDEX idx_orders_date_rep ON order_header(order_date, salesrep_code);
CREATE INDEX idx_orders_customer ON order_header(customer_code, order_date);

-- Use bitmap indexes for low-cardinality columns
CREATE BITMAP INDEX idx_orders_status ON order_header(order_status);
```

### 9.2 API Response Times

| Endpoint | Target Response Time | Caching Strategy |
|----------|---------------------|------------------|
| Dashboard KPIs | < 500ms | Cache for 5 minutes |
| Trends | < 1s | Cache for 15 minutes |
| Rankings | < 800ms | Cache for 10 minutes |
| Predictions | < 2s | Cache for 1 hour |

### 9.3 Mobile Caching Strategy

```javascript
// Cache configuration
const CACHE_CONFIG = {
  dashboard_kpis: { ttl: 5 * 60 * 1000 },      // 5 minutes
  shop_performance: { ttl: 10 * 60 * 1000 },   // 10 minutes
  trends: { ttl: 15 * 60 * 1000 },             // 15 minutes
  predictions: { ttl: 60 * 60 * 1000 },        // 1 hour
  historical_data: { ttl: 24 * 60 * 60 * 1000 } // 24 hours
};
```

### 9.4 Data Refresh Strategy

| Data Type | Refresh Frequency | Method |
|-----------|------------------|--------|
| Today's sales | Real-time | Direct query |
| Yesterday's summary | Daily 2 AM | Batch job |
| Weekly rollups | Daily 3 AM | Materialized view refresh |
| Monthly rollups | Daily 4 AM | Materialized view refresh |
| Customer summaries | Daily 5 AM | Batch job |
| Predictions | Weekly Sunday 6 AM | ML model refresh |

---

## 10. Technical Specifications

### 10.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Database | Oracle Database (Autonomous) |
| Backend APIs | Oracle ORDS (REST) |
| Mobile App | React Native + Expo |
| Charts | react-native-chart-kit / victory-native |
| Local Storage | AsyncStorage / expo-sqlite |
| State Management | React Context / useState |

### 10.2 API Authentication

```javascript
// All analytics APIs require authentication
const headers = {
  'Authorization': `Bearer ${authToken}`,
  'Content-Type': 'application/json',
  'X-Shop-Code': userShopCode,  // For shop-specific filtering
  'X-User-Role': userRole        // admin, manager, salesrep
};
```

### 10.3 Role-Based Access

| Role | Dashboard | All Shops | Own Shop | Salesrep Data |
|------|-----------|-----------|----------|---------------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ❌ | ✅ | ✅ (own shop) |
| Salesrep | ✅ (limited) | ❌ | ❌ | ✅ (own only) |

### 10.4 Error Handling

```javascript
// Standardized error response
{
  "success": false,
  "error": {
    "code": "ANALYTICS_001",
    "message": "Failed to fetch dashboard data",
    "details": "Database connection timeout"
  },
  "timestamp": "2025-12-26T10:30:00Z"
}
```

---

## Appendix A: Sample Queries

### A.1 This Month vs Last Month

```sql
SELECT
    'Current' AS period,
    SUM(total_net) AS total_sales,
    SUM(total_orders) AS total_orders,
    SUM(total_customers) AS total_customers
FROM sales_daily_summary
WHERE summary_date >= TRUNC(SYSDATE, 'MM')
UNION ALL
SELECT
    'Previous' AS period,
    SUM(total_net) AS total_sales,
    SUM(total_orders) AS total_orders,
    SUM(total_customers) AS total_customers
FROM sales_daily_summary
WHERE summary_date >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)
  AND summary_date < TRUNC(SYSDATE, 'MM');
```

### A.2 Year-over-Year Comparison

```sql
SELECT
    TO_CHAR(summary_date, 'MM') AS month,
    SUM(CASE WHEN EXTRACT(YEAR FROM summary_date) = 2025 THEN total_net ELSE 0 END) AS sales_2025,
    SUM(CASE WHEN EXTRACT(YEAR FROM summary_date) = 2024 THEN total_net ELSE 0 END) AS sales_2024,
    ROUND(
        (SUM(CASE WHEN EXTRACT(YEAR FROM summary_date) = 2025 THEN total_net ELSE 0 END) -
         SUM(CASE WHEN EXTRACT(YEAR FROM summary_date) = 2024 THEN total_net ELSE 0 END)) /
        NULLIF(SUM(CASE WHEN EXTRACT(YEAR FROM summary_date) = 2024 THEN total_net ELSE 0 END), 0) * 100
    , 2) AS yoy_growth
FROM sales_daily_summary
WHERE summary_date >= DATE '2024-01-01'
GROUP BY TO_CHAR(summary_date, 'MM')
ORDER BY month;
```

### A.3 Top 10 Products with Trend

```sql
WITH current_period AS (
    SELECT item_code, SUM(qty_sold) AS current_qty, SUM(total_revenue) AS current_rev
    FROM product_daily_summary
    WHERE summary_date >= TRUNC(SYSDATE, 'MM')
    GROUP BY item_code
),
previous_period AS (
    SELECT item_code, SUM(qty_sold) AS prev_qty, SUM(total_revenue) AS prev_rev
    FROM product_daily_summary
    WHERE summary_date >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)
      AND summary_date < TRUNC(SYSDATE, 'MM')
    GROUP BY item_code
)
SELECT
    c.item_code,
    p.item_description,
    c.current_qty,
    c.current_rev,
    ROUND((c.current_rev - NVL(pr.prev_rev, 0)) / NULLIF(pr.prev_rev, 0) * 100, 2) AS growth_rate
FROM current_period c
JOIN product_daily_summary p ON c.item_code = p.item_code
LEFT JOIN previous_period pr ON c.item_code = pr.item_code
WHERE ROWNUM <= 10
ORDER BY c.current_rev DESC;
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| AOV | Average Order Value - Total Revenue / Number of Orders |
| Churn Rate | Percentage of customers who stopped purchasing |
| CLV | Customer Lifetime Value - Total revenue from a customer |
| MoM | Month-over-Month comparison |
| YoY | Year-over-Year comparison |
| Retention Rate | Percentage of customers who continue purchasing |
| Cohort | Group of customers who started in the same period |
| SKU | Stock Keeping Unit - Unique product identifier |
| Materialized View | Pre-computed query result stored in database |

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 2025 | Dev Team | Initial document |

---

*End of Document*
