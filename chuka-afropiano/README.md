# Afropiano Edition 1 Chuka (live version)

Static pages (HTML, CSS, JS) plus a small server side in `/api` (Vercel serverless functions) and a Postgres database (Supabase).
Tickets are only ever created by the server, after it has matched a real payment.

## How payment works
1. Customer picks a ticket or offer, sets the quantity and types **one name per person admitted** (no phone number, names are not checked, only that none is blank). Button: **Book your ticket**.
2. Server creates the order (`AFR-XXXXXX`, status `PENDING`) and works out the price itself.
3. Customer sees the payment screen: **Paybill 247247, Account 1500184456952** (tap to copy), amount and order reference.
4. Customer pays with M-Pesa and enters the **transaction code** from the SMS.
5. Server saves the code (each code can only ever be used on one order) and sets `AWAITING_VERIFICATION`. **No ticket yet.**
6. Server compares the code with real money received (table `bank_credits`). If a credit with the same code, at least the same amount, on the right account exists, and the code is not used by another order, the order becomes `PAID` and the ticket is issued. If the money has not shown up yet, the customer's page keeps checking and the ticket appears the moment it does.
7. Ticket IDs look like `AFP-001003-XQL`. They come from a database sequence, so a number is never issued twice. The QR code is signed with `TICKET_SECRET`, so a fake QR fails at the gate.

Every name typed at checkout is printed on the ticket (numbered when there is more than one), so the gate can match the group. Customers get the ticket as an on-screen ticket, a **Save to gallery / Download image** button (PNG), a private ticket link (`/ticket?id=...&k=...`) and they can screenshot it.

## Where does the "real money" list come from? (important)
Paybill 247247 is Equity Bank's, so Safaricom Daraja's C2B callbacks are not available to you on it. Pick one of these, they all fill the same table:
- **Automatic:** ask Equity (Jenga / your relationship manager) for payment notifications (IPN) on account 1500184456952 and point them to `POST /api/ipn` with header `x-ipn-secret: IPN_SECRET`. Field names are flexible (see comments in `api/ipn.js`).
- **Manual, works today:** open **/admin**, paste the lines of your Equity statement or the bank SMS messages into "Add received payments". Matching orders are approved automatically. Press "Re-check all waiting" any time.
- **Fallback:** in /admin you can approve or reject any waiting order by hand.

Until one of these runs, orders stay `AWAITING_VERIFICATION` and no ticket is issued. That is intentional.

## Set up
1. Supabase: create a project, run `supabase.sql` in the SQL Editor.
2. Push this folder to GitHub, import in Vercel (framework preset **Other**, no build command).
3. Vercel > Settings > Environment Variables (see `.env.example`): `DATABASE_URL` (Supabase "Transaction pooler" connection string), `TICKET_SECRET`, `ADMIN_KEY`, `IPN_SECRET`.
4. Open `/admin`, sign in with `ADMIN_KEY`.
5. Fill `CONTACT_WHATSAPP` in `assets/js/config.js` so customers can message you from the verification screen.

## Change prices, offers, offer end date
Server (the real values): `api/_lib/catalog.js`. The 3-day offer end can also be set with the `OFFER_ENDS` environment variable. Keep `assets/js/config.js` the same (it is only a display fallback). Offer window is set to end **03 Oct 2026, 08:00 (Nairobi)**, a fresh 3 days from 30 Sep. To restart it again, change that date in `api/_lib/catalog.js` and `assets/js/config.js` (or set `OFFER_ENDS` in Vercel, which overrides the file).

To also refill the bundles, run in Supabase: `update offer_stock set claimed = 0;`

## Gate
`/admin` > Gate scanner: paste or type what a QR scanner reads (or the ticket ID). It says VALID, CHECKED IN, ALREADY USED or INVALID. One ticket admits the number of people printed on it.

## Safety rules built in
- Prices and totals are calculated on the server only. The browser cannot set an amount.
- The database is not reachable from the browser (no public keys, row security on).
- 5 code attempts per order, max 10 open unpaid orders per connection, unpaid bundle holds expire after 30 minutes.
- Order pages and tickets need a private token, so other people cannot open them by guessing.

## Still to do before you go live
- Replace footer social links and set contact details.
- The crowd photos are generic nightlife photos. Confirm you may use them.
- Headliner names in `index.html` (search `Headliner`).
- Test one real KES 10 payment end to end with your own phone, then add it in /admin.
