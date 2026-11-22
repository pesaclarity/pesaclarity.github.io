---
title: "Send to Firefly III"
description: "If you run your own Firefly III server, Pesa Clarity can send your transactions to it, one way. They go only to your server, never to ours."
order: 4
updated: 2026-11-22
---

[Firefly III](https://github.com/firefly-iii/firefly-iii) is a free personal finance manager that you run on your own server, often at home. If you use it, Pesa Clarity can send it the transactions it reads from your M-Pesa and bank messages, so you don't type them again.

- It is **off** until you turn it on.
- It sends **one way**: from your phone to your server. Nothing is read back.
- Your transactions go **only to the server you type**, straight from your phone. They never pass through Pesa Clarity's servers, and we can't see them.
- It is free in every build: Google Play, F-Droid and iPhone.

You need Firefly III 6.0 or later.

## Make a token in Firefly III

The app signs in to Firefly III with a personal access token.

1. Open Firefly III in your browser and go to **Profile** (your email at the top).
2. Open **Remote access and tokens**.
3. Under **Personal access tokens**, create a new token. Give it a name you will know, such as "Pesa Clarity".
4. Copy the token. It is long, and Firefly III may not show it again.

The token stays in your phone's secure storage. It is never in a backup, a log or a crash report. If you lose it, make a new one.

## Set it up

1. On **Home**, tap **Profile** at the top right, then **Firefly III**, under **Backup and restore**.
2. Under **Your server**, type the **Server address**, such as `https://firefly.example.home`.
3. Paste the token into **Personal access token**. Tap the eye to see what you pasted.
4. Tap **Check connection**. The app says **Connected to Firefly III** and the version it found.
5. Under **What to send**, switch on each space you want to send. Each space goes as a tag with its name.
6. Choose **Send from**: 1 January this year (the usual), the 1st of this month, or **Everything**.
7. Tap **Start sending**. The first send can take a while. If you close the app, it carries on next time.

After that, the app sends new changes quietly when the phone is online, after you unlock it and each time you come back to it. Profile shows **Sending to firefly.example.home** and when it last sent.

## Your server's certificate

Pesa Clarity's own servers are pinned to the certificate authorities we chose. Your server is not: we don't know who signs its certificate. The app trusts it in one of two ways, and only for that one server:

- **A certificate your phone already trusts**, such as one from Let's Encrypt. You don't need to do anything.
- **A certificate you confirm.** If your server uses its own certificate (self-signed, or from a home authority), **Check connection** asks **Trust this certificate?** and shows its SHA-256 fingerprint. Compare it with the fingerprint on your server, and tap **Trust it** only if they match. On the server, `openssl x509 -noout -fingerprint -sha256 -in cert.pem` prints it.

The app then accepts exactly that certificate. If it changes, for example when you renew it, the app stops and asks again. It never accepts a new one quietly.

The app also never follows a redirect, so your token is never sent to another address.

## Plain http on your home network

Use `https` if you can. Plain `http` is not encrypted, so anyone on the same network could read your transactions and token.

The app allows `http` only to an address on your home network: one starting with 10., 172.16 to 172.31 or 192.168., or a name ending in `.local` or `.home.arpa`, such as `http://firefly.local`. Before it connects, it asks **Use a plain connection?** Tap **Use it** only on a network you trust. Plain `http` to an address on the internet is always refused.

On iPhone, the first time the app reaches a server on your home network, the phone asks whether Pesa Clarity may find devices on your local network. Allow it, or the app can't reach your server.

## What is sent

- **Spaces** become tags: each transaction is tagged with its space's name and `pesaclarity`.
- **Accounts**: your M-Pesa, bank and Cash accounts become asset accounts. Fuliza, loans and debts you owe become liabilities. A space's own accounts carry its name, such as "M-Pesa · Example Shop".
- **Payees** become expense or revenue accounts, so Firefly III's reports by payee work. A payee you haven't named yet goes as "Not named yet", tagged `pesaclarity-to-name`, and is changed when you name it.
- **Categories** go by name. Firefly III makes any it doesn't have.
- **Fees**: an M-Pesa or bank fee goes as a separate withdrawal to the expense account "Fees", so your totals match Pesa Clarity's.
- **Opening balances**: each account starts with its balance in Pesa Clarity on the Send from day, 1 January this year unless you chose another. Transactions before that day are not sent. If you move Send from earlier, the older transactions are sent and the opening balances change.
- **The M-Pesa code** and the time go in each transaction's notes and date.

Message text is never sent (the app doesn't keep it). Goals, budgets, invoices and stock are not sent either.

**Edits.** When you change a transaction in Pesa Clarity, the app sends only what changed. If one of Firefly III's own rules changed another field, that change stays. If you move a transaction to a space you don't send, it is deleted from Firefly III.

**Nothing twice.** Each transaction carries its own id, so sending again never makes a copy.

## Send everything again

If you delete a transaction in Firefly III, Pesa Clarity does not send it again, even when you change it on your phone.

To put back what you deleted there, open the menu at the top right of the Firefly III screen and tap **Send everything again**. Everything is checked against your server, and what is missing is sent. Nothing already there is sent twice.

## Turn it off

- **One space**: on the Firefly III screen, switch it off under **What to send**.
- **Everything**: tap **Turn off** at the bottom, then **Turn off** again. The token and any changes still waiting are removed from your phone.

What is already in Firefly III stays there, also when you delete a space in Pesa Clarity. We can't see or delete anything on your server. To remove it, delete it in Firefly III.

## If something goes wrong

Problems show only on the Firefly III screen, never on Home or as a pop-up. Changes wait on your phone until they can be sent.

### When you tap Check connection

- **Type the address of your Firefly III server.** The address is empty, or not an address.
- **Use https. Plain http is only for an address on your home network.** Plain `http` is allowed only to a home network address. Use `https`.
- **Type only the server address, such as https://firefly.home.** Leave out any user name, password, or anything after `?` or `#`.
- **Paste a personal access token.** No token has been pasted or saved yet. See Make a token in Firefly III, above.
- **The saved token was refused.** Firefly III didn't accept the token. Make a new one and paste it.
- **Can't reach firefly.example.home. Is the server on, and is this phone on its network?** Check that the server is running, and that your phone is on the network it is on (for a home server, your home Wi-Fi).
- **firefly.example.home uses a certificate this phone doesn't know.** The app asks **Trust this certificate?** See Your server's certificate, above.
- **This address sends the app somewhere else. Type the address Firefly III itself is at.** The address redirects. Type the address Firefly III answers at, for example with `https` in place of `http`, or with the path it lives under.
- **This is Firefly III 5.7. Pesa Clarity needs 6.0 or later.** Update Firefly III.
- **This address doesn't answer as Firefly III.** Something answers, but it isn't Firefly III. Check the address.
- **Firefly III didn't answer as expected. Try again.** Your server sent an error. Try again later, and check Firefly III's own logs if it keeps happening.

### While sending

- **Can't reach firefly.example.home.** The server is off or your phone isn't on its network. Changes wait on your phone and are sent when it answers. Tap **Try again** to send now.
- **Firefly III didn't accept the token.** The token may have expired or been deleted in Firefly III. Sending stops until you paste a new one and tap **Check connection**.
- **firefly.example.home has a certificate this phone doesn't know.** The certificate changed. Tap **Check connection** to see the new one and decide whether to trust it.
- **firefly.example.home sends the app somewhere else.** Tap **Server address** and change it to where Firefly III itself is.
- **firefly.example.home doesn't answer as Firefly III 6 or later.** Check the address, then tap **Check connection**.
- **Firefly III refused**: a list of transactions Firefly III would not take, each with Firefly III's reason, its space and its number. The rest carry on. Fix what the reason names, then change the transaction in Pesa Clarity and it is tried again.

**Changes waiting** shows how many changes are still on your phone. If it doesn't go down, check the server and tap **Send now**.

## Read the policy

The privacy policy's Firefly III section says what is sent and what we can and can't do. It is [on this site](/privacy/).
