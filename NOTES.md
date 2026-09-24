# Notes

More detail on how the checkout works: the message protocol, the API contract, security, and the states it handles. For setup, see the [README](README.md).

## How the pieces talk

```
Demo store ── <script src="{checkout}/dodo-checkout.js">
   │
   │ DodoCheckout.open({ productId, ...callbacks })
   ▼
SDK ── adds overlay + <iframe src="{checkout}/checkout?productId=…&origin={store origin}">
   ▲
   │ postMessage(msg, storeOrigin)      ready | success | error | close
   │
Checkout (iframe) ── form, validation, fake payment
   │
   ▼
SDK ── checks origin + source, copies whitelisted fields ──▶ onSuccess / onError / onClose
```

- The SDK works out the checkout origin from its own `<script src>`, so there's nothing to configure.
- The store's origin travels in the iframe URL. The checkout posts every message to exactly that origin. If a page embeds the checkout while claiming to be a different origin, the browser drops the messages.
- Messages go **one way**. The checkout never listens to the host, so a host page has no channel to steer or query it.
- The SDK ignores any message that isn't from the checkout origin **and** from its own iframe's window. It then builds fresh callback payloads from known fields and never passes the raw message through.

| Message   | Payload                | Callback                               |
| --------- | ---------------------- | -------------------------------------- |
| `ready`   | none                   | reveals the iframe and moves focus in  |
| `success` | `sessionId`            | `onSuccess({ sessionId })`             |
| `error`   | `code`, `message`      | `onError({ code, message })`           |
| `close`   | `reason`               | `onClose({ reason })`, then teardown   |

## API

```js
DodoCheckout.open({
  productId: "prod_grit_yearly",
  onSuccess: ({ sessionId }) => {},
  onClose: ({ reason }) => {},       // "user" | "success" | "error"
  onError: ({ code, message }) => {},
});
```

The contract is meant to be easy to reason about:

- **Every `open()` ends with exactly one `onClose`.** Clean up there, whatever happened.
- `onSuccess` fires as soon as the payment goes through, not when the customer dismisses the receipt.
- `onError` fires for each failed attempt. The checkout stays open so the customer can retry, so an error is not the end of the session. The codes are `PAYMENT_DECLINED`, `PAYMENT_FAILED`, `PRODUCT_NOT_FOUND` and `CHECKOUT_UNAVAILABLE` (the iframe didn't report ready within 10s).
- `open()` while a checkout is already open does nothing and returns `false`.
- A missing `productId` **throws**. That's a bug in the integration, not something to recover from at runtime.
- An exception thrown inside a merchant callback is caught and logged, so it can't leave the overlay stuck on the page.

## Products

| Product ID          | Plan                           | Due today |
| ------------------- | ------------------------------ | --------- |
| `prod_grit_yearly`  | ₹699 / year, with a 7-day free trial | ₹0        |
| `prod_grit_monthly` | ₹99 / month                    | ₹99       |

The plan picker belongs to the merchant, and the checkout belongs to Dodo. The checkout looks up the price itself from the `productId`, so the host page can't change what the customer is charged. For the trial, the checkout spells out the timeline (today ₹0, when we'll remind you, when the first charge happens) right next to the button, because a surprise first charge is the thing people hate most about free trials.

## Payment simulation

`lib/payment.ts` waits about 1.6s, then decides the result from the card number:

| Card                  | Result                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `4242 4242 4242 4242` | Succeeds                                                            |
| `4000 0000 0000 0002` | Declined: the card field is selected so the customer can try another |
| `4000 0000 0000 0341` | Fails the first time in a checkout session, then succeeds on "Try again" |

The checkout shows these cards as click-to-fill chips, labelled "Test mode". Any other valid card number succeeds. Use any future expiry date and any 3-digit CVC.

## States I handled

- **Loading:** the SDK shows a backdrop and spinner until the checkout says `ready`. Escape cancels.
- **Checkout never loads:** after 10s the host gets `onError(CHECKOUT_UNAVAILABLE)`, then `onClose("error")`.
- **Invalid form:** errors appear under each field after it loses focus and on submit. Focus jumps to the first invalid field.
- **Double-clicking Pay:** a ref guards against it, so only one payment attempt runs.
- **During processing:** the fields become read-only. Close, Escape and backdrop clicks are all ignored.
- **Declined vs failed:** the copy differs because the fix differs ("try another card" vs "try again"). Both say plainly that the customer **hasn't been charged**.
- **Offline:** caught before any attempt is made.
- **Connection drops mid-payment:** turn on "Offline" in DevTools while the payment is processing. The checkout shows "Connection lost, your card wasn't charged" and the host gets `onError(PAYMENT_FAILED)`.
- **Checkout can't load:** the host gets `CHECKOUT_UNAVAILABLE`. The demo's plan picker then tells the customer, instead of the spinner just disappearing.
- **Unknown product:** the checkout shows an explanation and the host gets `PRODUCT_NOT_FOUND`.
- **Checkout URL opened directly:** shows an empty state instead of a broken form.
- **Focus:** trapped inside the dialog, and restored to the element that opened the checkout when it closes. Page scroll is locked while the checkout is open. Motion is reduced when the user asks for it.

## Security considerations

This is a demo, not a payment system, but the lines are drawn where a real one would draw them:

- **Card data stays in the iframe.** The host page can't read a cross-origin iframe's DOM. Card data never appears in the URL, in messages, in storage, or in logs.
- **The host learns outcomes, not internals.** It gets a session ID, an error code and a close reason. It doesn't learn the card brand, the last four digits, or the customer's email. A merchant who needs those should fetch them from their server using the session ID, not trust the browser.
- **The host can't customise the checkout.** No theming and no copy overrides. A consistent checkout is part of what makes it trustworthy, and it closes off "restyle it to look like something else" tricks.
- **What's missing for production:**
  - a server-side check that `origin` belongs to the merchant who owns `productId`;
  - a `frame-ancestors` CSP built from that list;
  - sessions created on the server;
  - an idempotency key on every payment attempt.
