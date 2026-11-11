# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain HTML, CSS and JS, no build step. Logic lives in `src/calc.js` and `src/store.js` (UMD globals `BillCalc`, `BillStore`), tested with `node --test`. Online resources such as Google Fonts are allowed.

## Users

One housemate, the bill-payer, in a shared dorm or rented house in Malaysia. Once a month the TNB bill arrives; they walk round reading each room's sub-meter, then on their phone enter the bill total and each reading, and tell everyone what they owe.

## Product Purpose

Split one monthly TNB electricity bill among housemates fairly: each pays their own room's metered usage at the bill's effective rate, plus an equal share of the common (unmetered) usage among those who were present. Success is a number per person the bill-payer trusts and the housemates accept without argument.

## Positioning

It never models tariffs, tiers, AFA, tax or rebates. The bill's final amount already contains them, so the tool divides that real number by real kWh. Every result can be expanded into the exact arithmetic, which is what settles disputes.

## Operating Context

- Inputs are copied from the paper/PDF TNB bill: Total Usage (kWh) and Total Bill Amount (RM), plus room sub-meter readings.
- Used on a phone, monthly, often standing near the meters.
- Housemates learn their amount from a screenshot of the results screen posted in the group chat. The results screen must read clearly as a phone screenshot.
- Submit commits the readings to history; the latest month can be deleted if submitted by mistake.

## Capabilities and Constraints

- Residents: add (with initial meter reading), rename, remove (soft delete), restore, override previous reading after a meter reset.
- Validation per proposal section 7; nothing saved when blocked.
- Money in integer sen; rate shown to 4 decimals, money to 2.
- Data lives only in this browser's localStorage; no accounts, no sync.
- Labels in English, matching the bill.

## Evidence on Hand

No brand, logo or real data. Any sample names or readings are synthetic.

## Product Principles

1. Show the working: every ringgit traces to a visible step.
2. The bill is the source of truth; never re-derive what the bill already says.
3. One person, one phone, one sitting: fast entry, no detours.
4. Mistakes are recoverable (delete latest month, override reading).

## Accessibility & Inclusion

Phone-first, large tap targets, numeric keypads (`inputmode="decimal"`), readable in a screenshot.
