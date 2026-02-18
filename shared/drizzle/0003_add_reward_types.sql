-- Migration: Add new reward action types
-- Date: 2026-02-18
-- Description: Adds wallet_connected, terminal_used, and notification_enabled to reward_action_type enum

-- Alter the reward_action_type enum to add new values
ALTER TYPE reward_action_type ADD VALUE IF NOT EXISTS 'wallet_connected';
ALTER TYPE reward_action_type ADD VALUE IF NOT EXISTS 'terminal_used';
ALTER TYPE reward_action_type ADD VALUE IF NOT EXISTS 'notification_enabled';
