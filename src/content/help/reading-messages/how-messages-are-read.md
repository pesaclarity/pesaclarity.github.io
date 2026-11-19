---
title: "How the app reads your messages"
description: "The app reads SMS only from the banks and wallets you tick, keeps the amount, date, fee and payee, and deletes the text. It all happens on your phone."
order: 1
updated: 2026-11-19
---

The app reads SMS only from the banks and wallets you tick. From each message it keeps the amount, date, fee, balance and who you paid, then deletes the message text. All of it happens on your phone.

This is how it works on Android. iPhone lets no app read SMS, so see [Add messages on iPhone](/help/reading-messages/iphone-messages/).

## Choose whose messages are read

1. On **Home**, tap **Profile** at the top right, then **My accounts**.
2. Tap **Add or remove accounts** and tick the banks and wallets you use.
3. On the same screen, under **Read messages from**, choose how far back to read: **All messages**, the last 3, 6 or 12 months, or **From a date**.

Messages from every other sender are filtered out before the app sees them, and never stored.

## When messages are read

- The first scan reads back as far as you chose.
- Each time you open the app, it reads what arrived since the last scan, then adds new messages as they land while it is open.
- Messages that arrive while the app is closed wait in your inbox for the next time you open it. Nothing runs in the background.

A message the app has read before is never added twice.

## Messages the app cannot read yet

When a bank words a message in a way the app has not seen, the message reader on your phone suggests the amount and payee, and the message waits in **Messages to check**. See [Check a message the app is still learning](/help/reading-messages/messages-to-check/).

## Read your messages again

When the app's readers improve, Home may say that messages were read again, with how many payments were found or updated. To read them again yourself, open **Profile › My accounts › Add or remove accounts** and, under **Read messages again**, tap **Read again**.

## Which banks and wallets

M-Pesa, Airtel Money, Co-operative Bank, Equity Bank, I&M Bank, KCB, Loop and Standard Chartered. To add yours, see [Add your bank](https://github.com/pesaclarity/ujumbe-parsers) on GitHub.
