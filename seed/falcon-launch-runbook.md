# Falcon launch runbook

This runbook covers the Project Falcon pilot launch.

## Before launch

1. Freeze changes to the checkout service 48 hours before launch.
2. Confirm the three pilot merchants have test transactions passing in staging.
3. Make sure the on-call engineer has access to the payments dashboard.

## Launch day

- Switch pilot merchants to Falcon one at a time, 30 minutes apart.
- Watch the error rate. Anything above 1% of payments for 10 minutes is a rollback signal.

## Rollback

Rollback means pointing the merchant back to the legacy checkout service with the feature flag `falcon_enabled = false`. It takes effect within two minutes. No data migration is needed, because Falcon writes to the same ledger.

## After launch

- Write a launch report within three working days.
- Rotate the Falcon access code.
- Review alerts that fired during the pilot and remove noisy ones.
