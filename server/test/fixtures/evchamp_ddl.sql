-- Snapshot of the EVChamp app's tables (copied from initDB in EVChamp/api/index.js, 2026-10-05).
-- Used only by tests. If EVChamp changes a lead table, refresh this file and rerun `npm test`.

CREATE TABLE IF NOT EXISTS cell_audits (
        id SERIAL PRIMARY KEY,
        audit_id TEXT UNIQUE NOT NULL,
        qr_raw TEXT,
        serial_number TEXT NOT NULL,
        manufacturer TEXT,
        manufacturer_code TEXT,
        model TEXT,
        model_code TEXT,
        chemistry TEXT,
        chemistry_code TEXT,
        production_type TEXT,
        production_line TEXT,
        task_code TEXT,
        factory_address TEXT,
        factory_identifier TEXT,
        production_date TEXT,
        capacity TEXT,
        voltage TEXT,
        country_of_origin TEXT,
        qr_authenticity_score INTEGER,
        qr_validation_status TEXT,
        auth_check_score INTEGER,
        auth_check_status TEXT,
        auth_check_details JSONB,
        certificate_number TEXT,
        certificate_generated BOOLEAN DEFAULT FALSE,
        cell_data JSONB,
        audited_by TEXT,
        audited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_cell_audits_serial ON cell_audits(serial_number);

CREATE INDEX IF NOT EXISTS idx_cell_audits_qr ON cell_audits(qr_raw);

CREATE INDEX IF NOT EXISTS idx_cell_audits_audit_id ON cell_audits(audit_id);

CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        clerk_id TEXT UNIQUE NOT NULL,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_sign_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

CREATE TABLE IF NOT EXISTS wallet_balance (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT UNIQUE NOT NULL,
        balance_paise BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_wallet_clerk_id ON wallet_balance(clerk_user_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        amount_paise BIGINT NOT NULL,
        direction TEXT NOT NULL,
        description TEXT,
        razorpay_payment_id TEXT,
        razorpay_order_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS credit_grant_outbox (
        id SERIAL PRIMARY KEY,
        razorpay_order_id TEXT NOT NULL,
        razorpay_payment_id TEXT,
        clerk_user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        service TEXT NOT NULL,
        unit_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | success | failed
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (razorpay_order_id, service, unit_type)
      );

CREATE INDEX IF NOT EXISTS idx_outbox_due ON credit_grant_outbox(status, next_attempt_at);

ALTER TABLE credit_grant_outbox ADD COLUMN IF NOT EXISTS coupon_code TEXT;

CREATE TABLE IF NOT EXISTS autopay_subscriptions (
        id SERIAL PRIMARY KEY,
        subscription_id TEXT UNIQUE NOT NULL,
        clerk_user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        plan_details JSONB,
        razorpay_subscription_id TEXT,
        status TEXT DEFAULT 'active',
        start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        next_renewal_date TIMESTAMP WITH TIME ZONE NOT NULL,
        last_charge_date TIMESTAMP WITH TIME ZONE,
        failed_attempts INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        payment_method JSONB,
        auto_charge_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_autopay_clerk_user_id ON autopay_subscriptions(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_autopay_subscription_id ON autopay_subscriptions(subscription_id);

CREATE INDEX IF NOT EXISTS idx_autopay_status ON autopay_subscriptions(status);

CREATE TABLE IF NOT EXISTS coupon_usage (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        coupon_code TEXT NOT NULL,
        discount_amount DECIMAL(10, 2),
        original_price DECIMAL(10, 2),
        final_price DECIMAL(10, 2),
        subscription_id TEXT,
        payment_id TEXT,
        used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(clerk_user_id, plan_id)
      );

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_plan ON coupon_usage(plan_id, clerk_user_id);

CREATE TABLE IF NOT EXISTS fcm_tokens (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT,
        fcm_token TEXT UNIQUE NOT NULL,
        device_name TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(is_active);

CREATE TABLE IF NOT EXISTS test_drive_bookings (
        id SERIAL PRIMARY KEY,
        reference TEXT UNIQUE NOT NULL,
        car_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        country_code TEXT,
        phone TEXT,
        city TEXT,
        preferred_date TEXT,
        address TEXT,
        time_slot TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS offer_leads (
        id SERIAL PRIMARY KEY,
        car_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        country_code TEXT,
        phone TEXT,
        offer_total INTEGER,
        source TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT,
        inquiry_type TEXT,
        message TEXT NOT NULL,
        email_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions(created_at);

CREATE TABLE IF NOT EXISTS sell_ev_listings (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT,
        user_email TEXT,
        user_name TEXT,
        brand TEXT,
        vehicle_model TEXT,
        year TEXT,
        mileage TEXT,
        price TEXT,
        location TEXT,
        contact_number TEXT,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_sell_ev_listings_user ON sell_ev_listings(clerk_user_id);

CREATE TABLE IF NOT EXISTS service_centre_listings (
        id SERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        manager_name TEXT,
        phone TEXT,
        email TEXT,
        city TEXT,
        address TEXT,
        service_type TEXT,
        status TEXT NOT NULL DEFAULT 'Pending verification',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS used_ev_enquiries (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT,
        customer_name TEXT,
        customer_email TEXT,
        car_id INTEGER,
        car_brand TEXT,
        car_name TEXT,
        car_price INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE TABLE IF NOT EXISTS plan_purchases (
        id SERIAL PRIMARY KEY,
        razorpay_order_id TEXT NOT NULL,
        razorpay_payment_id TEXT NOT NULL,
        clerk_user_id TEXT,
        plan_name TEXT,
        description TEXT,
        customer_email TEXT,
        customer_name TEXT,
        amount_paise INTEGER,
        currency TEXT NOT NULL DEFAULT 'INR',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (razorpay_order_id, razorpay_payment_id)
      );

CREATE INDEX IF NOT EXISTS idx_plan_purchases_user ON plan_purchases(clerk_user_id);

CREATE TABLE IF NOT EXISTS ze_xperience_registrations (
        id SERIAL PRIMARY KEY,
        mode TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        city TEXT,
        finish TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

CREATE INDEX IF NOT EXISTS idx_ze_xperience_registrations_email ON ze_xperience_registrations(email);
