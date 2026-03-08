# Admin Audit Log Implementation

## Overview
This implementation adds a comprehensive audit logging system for tracking all privileged admin actions in the SwapSmith admin dashboard. The system provides an immutable audit trail that meets compliance and security requirements for financial applications.

## Database Schema Changes

### New Table: `admin_audit_log`

```sql
CREATE TABLE "admin_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "admin_id" text NOT NULL,
  "admin_email" text NOT NULL,
  "action" text NOT NULL,
  "target_resource" text,
  "target_id" text,
  "metadata" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "idx_admin_audit_log_admin" ON "admin_audit_log" ("admin_id");
CREATE INDEX "idx_admin_audit_log_action" ON "admin_audit_log" ("action");
CREATE INDEX "idx_admin_audit_log_created_at" ON "admin_audit_log" ("created_at");
CREATE INDEX "idx_admin_audit_log_target" ON "admin_audit_log" ("target_resource", "target_id");
```

### Migration Steps

To apply the schema changes, run the following commands from the `shared` directory:

```bash
cd shared
npm run db:gen    # Generate migration from schema
npm run db:push   # Apply migration to database
```

Alternatively, you can manually execute the SQL above in your database.

## Implementation Details

### 1. Audit Logger Service (`shared/lib/audit-logger.ts`)

Core service for logging admin actions:

```typescript
logAdminAction({
  adminId: 'firebase_uid',
  adminEmail: 'admin@example.com',
  action: AUDIT_ACTIONS.APPROVE_ADMIN_REQUEST,
  targetResource: 'admin_request',
  targetId: '123',
  metadata: { /* additional context */ },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
})
```

**Features:**
- Non-blocking error handling (audit failures don't break operations)
- Standardized action constants
- IP address and user agent extraction helpers
- System admin ID for email-based actions

### 2. Audited Admin Actions

All privileged admin operations are now logged:

#### Admin Access Control
- `APPROVE_ADMIN_REQUEST` - Approving admin access requests
- `REJECT_ADMIN_REQUEST` - Rejecting admin access requests

#### User Management
- `SUSPEND_USER` - Suspending user accounts
- `UNSUSPEND_USER` - Reactivating suspended users
- `FLAG_USER` - Flagging users as high-risk
- `UNFLAG_USER` - Removing high-risk flags

#### Testnet Coin Management
- `GIFT_COINS` - Gifting coins to individual users
- `DEDUCT_COINS` - Deducting coins from users
- `RESET_COINS` - Resetting user coin balances
- `GIFT_COINS_ALL` - Bulk coin gifting to all users

#### Platform Configuration
- `UPDATE_SWAP_CONFIG` - Updating multiple config fields
- `TOGGLE_EMERGENCY_STOP` - Enabling/disabling swap execution
- `UPDATE_API_KEYS` - Updating SideShift API keys (redacted in logs)

#### Monitoring
- `VIEW_AUDIT_LOG` - Accessing the audit log itself

### 3. Audit Log Viewer

**Access:** `/admin/audit-log` (super_admin only)

**Features:**
- Real-time audit log display with pagination (50 entries per page)
- Filtering by:
  - Action type
  - Admin ID (Firebase UID)
  - Date range (7/30/90/365 days)
- Detailed metadata viewer (expandable JSON)
- IP address and user agent tracking
- Responsive design matching existing admin pages

**API Endpoint:** `GET /api/admin/audit-log`

Query parameters:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)
- `action` - Filter by action type
- `adminId` - Filter by admin Firebase UID
- `days` - Filter by date range (default: 30)

### 4. AdminNavbar Integration

The audit log link is automatically shown in the admin navbar for users with `super_admin` role. Regular admins won't see this option.

## Security Features

1. **Access Control:**
   - Only `super_admin` role can access audit logs
   - Attempting to access as non-super_admin returns 403 Forbidden

2. **Data Protection:**
   - API keys are redacted as `***REDACTED***` in audit logs
   - Sensitive data is never logged in plaintext

3. **Audit Trail Integrity:**
   - Immutable audit trail (no update/delete operations)
   - Timestamped entries for forensic analysis
   - IP addresses and user agents captured for investigation

4. **Non-Breaking:**
   - Audit logging failures don't break main operations
   - Errors are logged to console but don't throw

## Testing Checklist

- [ ] **Database Migration:**
  - [ ] Run `npm run db:gen` successfully
  - [ ] Apply migration with `npm run db:push`
  - [ ] Verify table and indexes exist in database

- [ ] **Audit Logging:**
  - [ ] Approve admin request → logs `approve_admin_request`
  - [ ] Reject admin request → logs `reject_admin_request`
  - [ ] Suspend user → logs `suspend_user`
  - [ ] Gift coins → logs `gift_coins`
  - [ ] Update platform config → logs appropriate action

- [ ] **Audit Log Viewer:**
  - [ ] Access `/admin/audit-log` as super_admin → succeeds
  - [ ] Access as regular admin → redirects to dashboard
  - [ ] Filter by action type → shows correct results
  - [ ] Filter by date range → shows correct results
  - [ ] Pagination works correctly
  - [ ] Metadata viewer expands and shows JSON

- [ ] **Security:**
  - [ ] API keys are redacted in audit logs
  - [ ] Non-super_admin users get 403 on API endpoint
  - [ ] IP addresses are captured correctly
  - [ ] Audit logging doesn't break on errors

## Compliance Benefits

1. **Regulatory Compliance:**
   - Demonstrates who did what, when, and from where
   - Immutable audit trail for investigations
   - Supports compliance with SOC 2, PCI DSS, GDPR requirements

2. **Security Monitoring:**
   - Detect unusual admin activity patterns
   - Investigate potential insider threats
   - Assess damage from compromised admin accounts

3. **Accountability:**
   - Clear attribution of all admin actions
   - No anonymous or untracked privileged operations
   - Built-in transparency for platform governance

## Future Enhancements

Potential improvements for future iterations:

1. **Alerting:**
   - Real-time alerts for suspicious admin activity
   - Email notifications for critical actions
   - Slack/Discord integration for admin action notifications

2. **Advanced Filtering:**
   - Search by target resource or metadata fields
   - Export audit logs as CSV/JSON
   - Date range picker for custom time periods

3. **Analytics:**
   - Admin activity dashboards
   - Trend analysis and anomaly detection
   - Compliance reports generation

4. **Retention Policies:**
   - Automatic archival of old audit logs
   - Configurable retention periods
   - Compliance with data retention regulations

## Troubleshooting

### Audit logs not appearing
- Check that the database migration was applied
- Verify admin has `super_admin` role in `admin_users` table
- Check browser console for API errors

### 403 Forbidden error
- Verify user role is `super_admin` (not just `admin`)
- Check session token is valid and not expired

### Missing audit log entries
- Audit logging is non-blocking - check server logs for errors
- Verify the admin action actually completed successfully

## Support

For questions or issues with the audit logging system, please:
1. Check the troubleshooting section above
2. Review the implementation code and comments
3. Contact the development team for assistance
