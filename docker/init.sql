-- Smart TASMAC PostgreSQL Initialization Script
-- Tamil Nadu State Marketing Corporation Ltd.
-- Prohibition & Excise Department, Government of Tamil Nadu

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Role Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CONSUMER', 'OPERATOR', 'ADMIN', 'DOCTOR', 'CARETAKER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_type AS ENUM ('LIMIT_REACHED', 'APPROACHING_LIMIT', 'TEETOTALER_BREACH', 'WEEKLY_LIMIT', 'MONTHLY_LIMIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─── Table: districts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    shop_count INTEGER DEFAULT 0,
    population INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aadhaar_hash VARCHAR(255) UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(15) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'CONSUMER',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    district VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: consumer_profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consumer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    daily_limit_ml INTEGER DEFAULT 750,
    weekly_limit_ml INTEGER DEFAULT 3000,
    monthly_limit_ml INTEGER DEFAULT 10000,
    is_teetotaler BOOLEAN DEFAULT FALSE,
    qr_token VARCHAR(255) UNIQUE,
    dob DATE,
    age_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    volume_ml INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    alcohol_percentage DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: shops ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    district VARCHAR(100) NOT NULL,
    district_id UUID REFERENCES districts(id),
    operator_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    license_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: purchases ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumer_id UUID NOT NULL REFERENCES users(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    quantity_ml INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    operator_id UUID REFERENCES users(id),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- ─── Table: limits_history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS limits_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumer_id UUID NOT NULL REFERENCES users(id),
    limit_type VARCHAR(50) NOT NULL,
    old_limit INTEGER,
    new_limit INTEGER NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);

-- ─── Table: caretaker_links ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caretaker_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumer_id UUID NOT NULL REFERENCES users(id),
    caretaker_id UUID NOT NULL REFERENCES users(id),
    consent_given BOOLEAN DEFAULT FALSE,
    consent_given_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(consumer_id, caretaker_id)
);

-- ─── Table: alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumer_id UUID NOT NULL REFERENCES users(id),
    alert_type alert_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: health_reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district VARCHAR(100) NOT NULL,
    district_id UUID REFERENCES districts(id),
    anonymized_count INTEGER DEFAULT 0,
    avg_consumption_ml DECIMAL(10,2),
    risk_level VARCHAR(20),
    high_risk_count INTEGER DEFAULT 0,
    medium_risk_count INTEGER DEFAULT 0,
    low_risk_count INTEGER DEFAULT 0,
    report_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table: audit_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id UUID,
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_purchases_consumer ON purchases(consumer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_shop ON purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchased_at);
CREATE INDEX IF NOT EXISTS idx_alerts_consumer ON alerts(consumer_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_health_district ON health_reports(district);
CREATE INDEX IF NOT EXISTS idx_consumer_profiles_user ON consumer_profiles(user_id);

-- ─── Seed Data: Tamil Nadu 38 Districts ───────────────────────────────────────
INSERT INTO districts (name, code, shop_count, population) VALUES
('Chennai', 'CHN', 310, 7088000),
('Coimbatore', 'CBE', 285, 3458000),
('Madurai', 'MDU', 245, 3038000),
('Tiruchirappalli', 'TRY', 210, 2722000),
('Salem', 'SLM', 195, 3482000),
('Tirunelveli', 'TNL', 180, 3072000),
('Tiruppur', 'TPR', 175, 2479000),
('Erode', 'ERD', 165, 2251000),
('Vellore', 'VLR', 155, 3936000),
('Thanjavur', 'TJR', 150, 2405000),
('Thoothukudi', 'TKI', 145, 1921000),
('Dindigul', 'DDG', 140, 2159000),
('Cuddalore', 'CDL', 135, 2605000),
('Villupuram', 'VLM', 130, 3458000),
('Kancheepuram', 'KCM', 125, 3998000),
('Nagercoil (Kanyakumari)', 'KNY', 120, 1876000),
('Nagapattinam', 'NPT', 115, 1616000),
('Pudukkottai', 'PDK', 110, 1618000),
('Namakkal', 'NMK', 108, 1726000),
('Krishnagiri', 'KRG', 105, 1883000),
('Dharmapuri', 'DHP', 100, 1506000),
('Ramanathapuram', 'RMD', 98, 1353000),
('Sivagangai', 'SVG', 95, 1339000),
('Virudhunagar', 'VRN', 92, 1942000),
('Tiruvannamalai', 'TVL', 90, 2464000),
('Theni', 'TNI', 88, 1243000),
('Karur', 'KRR', 85, 1065000),
('Perambalur', 'PRB', 75, 565000),
('Ariyalur', 'ARL', 73, 754000),
('Kallakurichi', 'KLK', 70, 1375000),
('Ranipet', 'RNP', 68, 1209000),
('Tirupattur', 'TPT', 65, 1115000),
('Tenkasi', 'TKS', 63, 1407000),
('Chengalpattu', 'CGP', 60, 2556000),
('Tiruvarur', 'TVR', 58, 1264000),
('Mayiladuthurai', 'MLD', 55, 918000),
('Nilgiris', 'NLG', 48, 735000),
('Tiruvallur', 'TVU', 175, 3728000)
ON CONFLICT (code) DO NOTHING;

-- ─── Seed Data: Products ──────────────────────────────────────────────────────
INSERT INTO products (name, category, volume_ml, price, alcohol_percentage) VALUES
('Old Monk Rum', 'Rum', 750, 520.00, 42.8),
('McDowell No.1 Whisky', 'Whisky', 750, 680.00, 42.8),
('Royal Stag Whisky', 'Whisky', 750, 720.00, 42.8),
('Kingfisher Strong Beer', 'Beer', 650, 85.00, 8.0),
('Haywards 5000', 'Beer', 650, 80.00, 7.0),
('Bacardi White Rum', 'Rum', 750, 890.00, 42.8),
('Teachers Scotch', 'Whisky', 750, 1050.00, 42.8),
('Signature Whisky', 'Whisky', 750, 780.00, 42.8),
('Imperial Blue', 'Whisky', 750, 640.00, 42.8),
('Honey Bee Brandy', 'Brandy', 750, 480.00, 42.8)
ON CONFLICT DO NOTHING;

-- ─── Seed Data: Demo Admin User ───────────────────────────────────────────────
-- Password: Admin@1234 (bcrypt hashed)
INSERT INTO users (full_name, email, password_hash, role, is_active, is_verified, district)
VALUES (
    'TASMAC Administrator',
    'admin@tasmac.gov.in',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaFMBVIFyKcmLEhq0b6fXpnEW',
    'ADMIN',
    TRUE,
    TRUE,
    'Chennai'
) ON CONFLICT (email) DO NOTHING;
