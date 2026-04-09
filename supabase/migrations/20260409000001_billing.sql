-- =============================================================================
-- Migration: billing
--
-- Adds Stripe subscription tracking to the creators table.
-- Creators start on the 'free' plan and upgrade to 'pro' or 'studio' via
-- Stripe Checkout. Plan enforcement lives in the API routes and Inngest jobs.
-- =============================================================================

-- ---- Enums ------------------------------------------------------------------

CREATE TYPE subscription_status AS ENUM (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

CREATE TYPE creator_plan AS ENUM ('free', 'pro', 'studio');

-- ---- Extend creators table --------------------------------------------------

ALTER TABLE creators
  ADD COLUMN plan                 creator_plan        NOT NULL DEFAULT 'free',
  ADD COLUMN stripe_customer_id   text                UNIQUE,
  ADD COLUMN stripe_subscription_id text              UNIQUE,
  ADD COLUMN subscription_status  subscription_status,
  ADD COLUMN plan_expires_at      timestamptz;

-- Index for webhook lookups by Stripe IDs
CREATE INDEX creators_stripe_customer_id_idx    ON creators (stripe_customer_id);
CREATE INDEX creators_stripe_subscription_id_idx ON creators (stripe_subscription_id);

-- ---- Comments ---------------------------------------------------------------

COMMENT ON COLUMN creators.plan IS
  'Active plan tier. Set to free by default; updated by Stripe webhook handler.';
COMMENT ON COLUMN creators.stripe_customer_id IS
  'Stripe Customer object ID (cus_*). Created on first checkout attempt.';
COMMENT ON COLUMN creators.stripe_subscription_id IS
  'Active Stripe Subscription ID (sub_*). Null for free-plan creators.';
COMMENT ON COLUMN creators.subscription_status IS
  'Mirrors Stripe subscription status. Null for free-plan creators.';
COMMENT ON COLUMN creators.plan_expires_at IS
  'UTC timestamp when the current paid period ends (from Stripe current_period_end). '
  'Used as a grace-period fallback if webhook delivery is delayed.';
