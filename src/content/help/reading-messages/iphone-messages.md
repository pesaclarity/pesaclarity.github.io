---
title: "Add messages on iPhone"
description: "iPhone lets no app read SMS. Instead, a Shortcuts automation you set up once passes each M-Pesa or bank message to the app as it arrives."
order: 3
updated: 2026-11-19
---

iPhone lets no app read SMS. Instead, you set up a Shortcuts automation once, and it passes each M-Pesa or bank message to Pesa Clarity as it arrives. The message stays on your iPhone.

## Set up the automation

1. In Pesa Clarity, open **Connect your messages**. It shows during setup, and later in **Profile › Connect messages**.
2. Tap **Open Shortcuts**, then **Automation**. Tap **+** and choose **Message**.
3. Choose the senders: MPESA and your bank. Then choose **Run Immediately**.
4. Add the action **Add transaction from message**, and pass it the message content and sender. Tap **Done**.
5. Back in Pesa Clarity, **Connect your messages** says **Connected** once the first message arrives, with when the last one came.

## What happens to each message

The automation hands the message to Pesa Clarity without opening it. It waits in a file only Pesa Clarity can open, even while your iPhone is locked, until the app next opens and reads it. A message still unread after 35 days is dropped.

From then on it is read like any other: the app keeps the amount, date, fee and payee, and deletes the text.

## Past months

Shortcuts passes only new messages, and iPhone gives no way to read the messages already on it. To bring in the months before, tap **Import a statement** under **Past months** on **Connect your messages**. See [Bring in past months from a statement](/help/reading-messages/import-a-statement/).
