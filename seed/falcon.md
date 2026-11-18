# Project Falcon

Project Falcon is the internal codename for the new payments gateway. It replaces the legacy checkout service for card and UPI payments.

## Access codes

The Project Falcon code is 7731. Only the platform team may share it, and it must be rotated after the launch.

## Owners

The platform team owns Falcon. The launch lead is the payments engineering manager, and the security review is done by the security team.

## Timeline

Falcon launches in Q3. The pilot runs with three merchants first: a bookstore, a grocery chain and a travel agency. General availability follows six weeks after a clean pilot.

## Goals

- Cut checkout latency below 300 ms at the 95th percentile.
- Support refunds through the same API as payments.
- Keep card data out of our servers by using the processor's hosted fields.
