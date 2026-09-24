# Dodo Checkout

A tiny embeddable checkout. A website adds one script, calls `DodoCheckout.open()`, and a secure checkout opens on top of the page. The customer never leaves the page, and the website never sees their card details.

**Live demo:** _add link here_

## Getting started

You'll need Node.js 20 or later.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

`npm run dev` compiles the SDK and starts the app. If you edit `sdk/dodo-checkout.ts` while it's running, run `npm run build:sdk` and refresh the page.

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Compiles the SDK and starts the dev server          |
| `npm run build`     | Compiles the SDK and makes a production build       |
| `npm run start`     | Serves the production build                         |
| `npm run build:sdk` | Compiles only the SDK to `public/dodo-checkout.js`  |
| `npm run lint`      | Runs ESLint                                         |

## Trying it out

1. Click **Try Pro** on the profile page.
2. Pick a plan (Yearly has a 7-day free trial, Monthly is ₹99) and continue.
3. The Dodo checkout opens. Enter any email and one of the test cards below.
4. Watch the **SDK events** panel on the right. It shows every callback the page receives.

| Card                  | Result                               |
| --------------------- | ------------------------------------ |
| `4242 4242 4242 4242` | Succeeds                             |
| `4000 0000 0000 0002` | Declined                             |
| `4000 0000 0000 0341` | Fails once, then succeeds on retry   |

Use any future expiry date and any 3-digit CVC. The checkout also has click-to-fill buttons for these cards.

The **Edge cases** panel lets you open an unknown product or call `open()` twice. To see a connection drop mid-payment, turn on **Offline** in DevTools while a payment is processing.

## What's in the project

There are three pieces:

- **SDK:** the one script a website adds. Plain TypeScript with no dependencies.
- **Checkout:** the payment form, running in an iframe on its own origin.
- **Demo app:** Grit, a pretend habit app that uses the SDK to sell its Pro plan.

```
sdk/
  dodo-checkout.ts      The SDK: DodoCheckout.open(), the overlay, the iframe, the callbacks
app/
  checkout/
    page.tsx            Checkout route (/checkout): reads the product and the host's origin
    Checkout.tsx        Checkout UI: form, validation, and the processing / error / success states
  page.tsx              Demo app: Grit profile page, loads the SDK
  Paywall.tsx           Demo app: Grit's plan picker, calls DodoCheckout.open()
  EventLog.tsx          Demo app: the SDK events panel
lib/
  payment.ts            Products, card validation and the fake payment
```

### Using the SDK

```html
<script src="https://<checkout-host>/dodo-checkout.js"></script>
<script>
  DodoCheckout.open({
    productId: "prod_grit_yearly",
    onSuccess: ({ sessionId }) => {},
    onError: ({ code, message }) => {},
    onClose: ({ reason }) => {}, // "user" | "success" | "error"
  });
</script>
```

### How it works

1. The SDK adds a full-screen overlay and an iframe pointing at `/checkout` on the checkout's own origin.
2. The customer enters their card inside the iframe. The website can't read it, because the iframe is on a different origin.
3. The checkout sends only high-level results to the page over `postMessage`: `ready`, `success`, `error` and `close`.
4. The SDK checks where each message came from, then calls `onSuccess`, `onError` or `onClose`.

Locally, the demo runs on `localhost` and loads the checkout from `127.0.0.1`. Browsers treat those as different origins, so the iframe is cross-origin just as it would be in production.

The message protocol, security, the states handled, the two decisions I went back and forth on, and what I'd explore next are all in **[NOTES.md](NOTES.md)**.

## Deploying

Deploy the repo twice, for example as two Vercel projects:

1. **Checkout:** deploy as is.
2. **Demo:** set `NEXT_PUBLIC_CHECKOUT_URL` to the checkout's URL, then deploy.

This keeps the demo and the checkout on separate domains, just as they would be for a real merchant.

## Tech

Next.js 16, React 19, TypeScript, Tailwind CSS 4 and lucide-react. No backend: the payment is simulated in `lib/payment.ts`.
