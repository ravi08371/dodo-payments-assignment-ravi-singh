"use client";

import { useEffect, useRef, useState } from "react";
import { fakePay, formatAmount, isValidCardNumber, TEST_CARDS, type Product } from "@/lib/payment";
import { CheckIcon, CloseIcon, LockIcon, Spinner } from "./icons";

type Field = "email" | "card" | "expiry" | "cvc";
type PaymentError = { code: "PAYMENT_DECLINED" | "PAYMENT_FAILED" | "OFFLINE"; title: string; text: string };

// The checkout only talks to the host, it never listens to it. The browser drops the
// message if the parent isn't actually on parentOrigin.
function postToHost(parentOrigin: string, message: Record<string, string>) {
  window.parent.postMessage({ source: "dodo-checkout", ...message }, parentOrigin);
}

function formatCard(digits: string) {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(digits: string) {
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export default function Checkout({ product, parentOrigin }: { product: Product | null; parentOrigin: string }) {
  const [email, setEmail] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);
  const [sessionId, setSessionId] = useState("");
  const isPaying = useRef(false);
  const hasSentReady = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isProcessing = status === "processing";

  useEffect(() => {
    if (hasSentReady.current) return;
    hasSentReady.current = true;
    // The SDK focuses the iframe once it hears "ready", so wait for that before focusing the first field.
    const focusEmail = () => document.getElementById("email")?.focus();
    if (document.hasFocus()) focusEmail();
    else window.addEventListener("focus", focusEmail, { once: true });
    postToHost(parentOrigin, { type: "ready" });
    if (!product) {
      postToHost(parentOrigin, { type: "error", code: "PRODUCT_NOT_FOUND", message: "This product isn't available." });
    }
  }, [product, parentOrigin]);

  function close() {
    // Closing mid-payment would leave both the customer and the host unsure whether money moved.
    if (isPaying.current) return;
    const reason = status === "success" ? "success" : product ? "user" : "error";
    postToHost(parentOrigin, { type: "close", reason });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") return close();
      if (event.key !== "Tab" || !dialogRef.current) return;

      // The iframe covers the whole page, so without this Tab would walk into the store behind it.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function validate() {
    const result: Partial<Record<Field, string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      result.email = email ? "Enter a valid email address." : "Enter your email.";
    }

    if (!card) result.card = "Enter your card number.";
    else if (card.length < 16) result.card = "Your card number is incomplete.";
    else if (!isValidCardNumber(card)) result.card = "Your card number is invalid.";

    const month = Number(expiry.slice(0, 2));
    const year = Number(expiry.slice(2));
    const now = new Date();
    const thisYear = now.getFullYear() % 100;
    if (expiry.length < 4) result.expiry = "Enter the expiry date.";
    else if (month < 1 || month > 12) result.expiry = "The expiry month is invalid.";
    else if (year < thisYear || (year === thisYear && month < now.getMonth() + 1)) {
      result.expiry = "Your card has expired.";
    }

    if (cvc.length < 3) result.cvc = "Enter the security code.";
    return result;
  }

  function handleBlur(field: Field, value: string) {
    if (value) setErrors((prev) => ({ ...prev, [field]: validate()[field] }));
  }

  function handleChange(field: Field, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field !== "email") setPaymentError(null);
  }

  function fillTestCard(number: string) {
    setCard(number);
    setExpiry("1230");
    setCvc("123");
    setErrors((prev) => ({ ...prev, card: undefined, expiry: undefined, cvc: undefined }));
    setPaymentError(null);
  }

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();
    if (isPaying.current || !product) return;

    const fieldErrors = validate();
    setErrors(fieldErrors);
    const firstInvalid = (["email", "card", "expiry", "cvc"] as Field[]).find((field) => fieldErrors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    if (!navigator.onLine) {
      setPaymentError({
        code: "OFFLINE",
        title: "You're offline",
        text: "Check your connection and try again. You haven't been charged.",
      });
      return;
    }

    isPaying.current = true;
    setPaymentError(null);
    setStatus("processing");
    const result = await fakePay(card);
    isPaying.current = false;

    if (result.ok) {
      setSessionId(result.sessionId);
      setStatus("success");
      postToHost(parentOrigin, { type: "success", sessionId: result.sessionId });
      return;
    }

    setStatus("idle");
    postToHost(parentOrigin, { type: "error", code: result.code, message: result.message });
    if (result.code === "PAYMENT_DECLINED") {
      setPaymentError({ code: result.code, title: "Your card was declined", text: "Try a different card. You haven't been charged." });
      const cardInput = document.getElementById("card") as HTMLInputElement | null;
      cardInput?.focus();
      cardInput?.select();
    } else {
      setPaymentError({
        code: result.code,
        title: "Payment couldn't be completed",
        text: "Something went wrong on our side and your card wasn't charged. Please try again.",
      });
    }
  }

  const amount = product ? formatAmount(product) : "";
  const cardError = errors.card ?? errors.expiry ?? errors.cvc;
  const brand = card.startsWith("4") ? "Visa" : /^5[1-5]/.test(card) ? "Mastercard" : null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="animate-panel-in relative flex max-h-[calc(100dvh-12px)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:max-h-[calc(100dvh-48px)] sm:max-w-105 sm:rounded-2xl"
      >
        <header className="flex items-center gap-2.5 px-6 pt-5 pb-1">
          <div className="grid size-7 place-items-center rounded-lg bg-zinc-900 text-[13px] font-semibold text-white">
            {product?.merchant[0] ?? "?"}
          </div>
          <span className="text-sm font-medium">{product?.merchant ?? "Checkout"}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Test mode</span>
          <button
            type="button"
            onClick={close}
            disabled={isProcessing}
            aria-label="Close checkout"
            className="-mr-2 ml-auto grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CloseIcon />
          </button>
        </header>

        {!product ? (
          <div className="px-6 pt-6 pb-6">
            <h2 id="checkout-title" className="text-lg font-semibold">This product isn&apos;t available</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              The store may have removed it, or the link is out of date. You haven&apos;t been charged.
            </p>
            <button type="button" onClick={close} className="btn-primary mt-6">
              Back to store
            </button>
          </div>
        ) : status === "success" ? (
          <div className="animate-fade-in px-6 pt-8 pb-6 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
              <CheckIcon />
            </div>
            <h2 id="checkout-title" className="mt-5 text-lg font-semibold">Payment successful</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              You&apos;re subscribed to {product.name}. A receipt is on its way to{" "}
              <span className="text-zinc-700">{email}</span>.
            </p>
            <dl className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-left text-sm">
              <div className="flex justify-between px-4 py-3">
                <dt className="text-zinc-500">Amount paid</dt>
                <dd className="font-medium tabular-nums">{amount}</dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-zinc-500">Reference</dt>
                <dd className="font-mono text-xs leading-5 text-zinc-700">{sessionId}</dd>
              </div>
            </dl>
            <button type="button" onClick={close} autoFocus className="btn-primary mt-6">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handlePay} noValidate className="flex min-h-0 flex-col">
            <div className="overflow-y-auto px-6 pb-6">
              <div className="pt-4 pb-6">
                <h2 id="checkout-title" className="text-sm text-zinc-500">{product.name}</h2>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{amount}</span>
                  {product.interval && <span className="text-sm text-zinc-500">per {product.interval}</span>}
                </p>
                <p className="mt-2 text-sm text-zinc-500">{product.description}</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    readOnly={isProcessing}
                    onChange={(e) => handleChange("email", e.target.value, setEmail)}
                    onBlur={() => handleBlur("email", email)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="input rounded-lg"
                  />
                  {errors.email && <p id="email-error" className="field-error">{errors.email}</p>}
                </div>

                <fieldset>
                  <legend className="label">Card details</legend>
                  <div className="relative">
                    <input
                      id="card"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 1234 1234 1234"
                      aria-label="Card number"
                      value={formatCard(card)}
                      readOnly={isProcessing}
                      onChange={(e) => handleChange("card", e.target.value.replace(/\D/g, "").slice(0, 16), setCard)}
                      onBlur={() => handleBlur("card", card)}
                      aria-invalid={!!errors.card}
                      aria-describedby={cardError ? "card-error" : undefined}
                      className="input rounded-t-lg pr-24 tabular-nums"
                    />
                    {brand && (
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold tracking-wide text-zinc-400">
                        {brand}
                      </span>
                    )}
                  </div>
                  <div className="-mt-px flex">
                    <input
                      id="expiry"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM / YY"
                      aria-label="Expiry date"
                      value={formatExpiry(expiry)}
                      readOnly={isProcessing}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (digits.length === 1 && Number(digits) > 1) digits = "0" + digits;
                        handleChange("expiry", digits, setExpiry);
                      }}
                      onBlur={() => handleBlur("expiry", expiry)}
                      aria-invalid={!!errors.expiry}
                      aria-describedby={cardError ? "card-error" : undefined}
                      className="input rounded-bl-lg tabular-nums"
                    />
                    <input
                      id="cvc"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="CVC"
                      aria-label="Security code"
                      value={cvc}
                      readOnly={isProcessing}
                      onChange={(e) => handleChange("cvc", e.target.value.replace(/\D/g, "").slice(0, 4), setCvc)}
                      onBlur={() => handleBlur("cvc", cvc)}
                      aria-invalid={!!errors.cvc}
                      aria-describedby={cardError ? "card-error" : undefined}
                      className="input -ml-px rounded-br-lg tabular-nums"
                    />
                  </div>
                  {cardError && <p id="card-error" className="field-error">{cardError}</p>}
                </fieldset>

                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">Test cards — click to fill</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TEST_CARDS.map((testCard) => (
                      <button
                        key={testCard.number}
                        type="button"
                        disabled={isProcessing}
                        onClick={() => fillTestCard(testCard.number)}
                        className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-zinc-900 disabled:opacity-50"
                      >
                        <span className="font-mono">•••• {testCard.number.slice(-4)}</span>
                        <span className="text-zinc-500"> · {testCard.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {paymentError && (
                <div role="alert" className="animate-fade-in mb-3 rounded-lg bg-red-50 px-3.5 py-3 text-sm">
                  <p className="font-medium text-red-800">{paymentError.title}</p>
                  <p className="mt-0.5 text-red-700">{paymentError.text}</p>
                </div>
              )}
              <button
                type="submit"
                aria-disabled={isProcessing}
                className="btn-primary aria-disabled:cursor-wait aria-disabled:opacity-80"
              >
                {isProcessing ? (
                  <>
                    <Spinner /> Processing…
                  </>
                ) : paymentError?.code === "PAYMENT_FAILED" ? (
                  "Try again"
                ) : (
                  `Pay ${amount}`
                )}
              </button>
              <p className="mt-3 text-center text-xs text-zinc-500">
                {isProcessing
                  ? "Hang tight, this only takes a moment."
                  : product.interval
                    ? `You'll be charged ${amount} today, then every ${product.interval} until you cancel.`
                    : `You'll be charged ${amount}.`}
              </p>
            </div>
          </form>
        )}

        <footer className="flex items-center justify-center gap-1.5 bg-zinc-50 px-6 py-3 text-xs text-zinc-500">
          <LockIcon />
          <span>
            Secured by <span className="font-medium text-zinc-700">Dodo Payments</span>
            {product && <> · {product.merchant} never sees your card</>}
          </span>
        </footer>
      </div>
    </div>
  );
}
