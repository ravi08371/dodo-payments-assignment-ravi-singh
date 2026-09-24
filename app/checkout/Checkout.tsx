"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { fakePay, formatAmount, getTrialDates, isValidCardNumber, TEST_CARDS, type Product } from "@/lib/payment";

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

  const price = product ? formatAmount(product.amount, product.currency) : "";
  const free = product ? formatAmount(0, product.currency) : "";
  const trial = product?.trialDays ? getTrialDates(product.trialDays) : null;
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
        className="animate-panel-in relative flex max-h-[calc(100dvh-12px)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl shadow-ink/20 sm:max-h-[calc(100dvh-48px)] sm:max-w-110 sm:rounded-3xl"
      >
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-100 px-5 py-4">
          <span className="justify-self-start rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Test mode
          </span>
          <h1 id="checkout-title" className="text-[17px] font-semibold text-ink">
            {status === "success" ? "All set" : "Checkout"}
          </h1>
          <button
            type="button"
            onClick={close}
            disabled={isProcessing}
            aria-label="Close checkout"
            className="-mr-1.5 grid size-9 place-items-center justify-self-end rounded-full text-ink transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        {!product ? (
          <div className="px-6 py-8 text-center">
            <h2 className="text-lg font-semibold text-ink">This plan isn&apos;t available</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              The store may have removed it, or the link is out of date. You haven&apos;t been charged.
            </p>
            <button type="button" onClick={close} className="btn-primary mt-6">
              Back to store
            </button>
          </div>
        ) : status === "success" ? (
          <div className="animate-fade-in px-6 pt-8 pb-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
              <Check size={26} strokeWidth={2.5} className="animate-draw" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-ink">
              {trial ? "Your free trial has started" : "Payment successful"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-zinc-500">
              {trial
                ? `You have full access to ${product.name} until ${trial.chargeOn}. We'll email ${email} a reminder on ${trial.remindOn}.`
                : `You're on ${product.name}. A receipt is on its way to ${email}.`}
            </p>
            <dl className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 text-left text-sm">
              <div className="flex justify-between px-4 py-3">
                <dt className="text-zinc-500">{trial ? "Paid today" : "Amount paid"}</dt>
                <dd className="font-medium text-ink tabular-nums">{trial ? free : price}</dd>
              </div>
              {trial && (
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-zinc-500">First charge</dt>
                  <dd className="font-medium text-ink">
                    {price} on {trial.chargeOn}
                  </dd>
                </div>
              )}
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
            <div className="space-y-5 overflow-y-auto px-6 pt-5 pb-6">
              <section className="rounded-2xl bg-violet-50/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-ink">
                      {product.name} · {product.plan}
                    </h2>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {trial
                        ? `${price}/${product.interval} after ${product.trialDays}-day trial`
                        : `Billed every ${product.interval}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Due today</p>
                    <p className="text-xl font-semibold text-ink tabular-nums">{trial ? free : price}</p>
                  </div>
                </div>
                {trial && (
                  <ol className="mt-4 space-y-2 border-t border-violet-100 pt-4 text-sm text-zinc-600">
                    <li className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-violet-600" />
                      <span><b className="font-semibold text-ink">Today</b>: full access, {free}</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-violet-400" />
                      <span><b className="font-semibold text-ink">{trial.remindOn}</b>: we&apos;ll remind you</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="size-2 shrink-0 rounded-full bg-violet-200" />
                      <span><b className="font-semibold text-ink">{trial.chargeOn}</b>: {price} charged, cancel before to pay nothing</span>
                    </li>
                  </ol>
                )}
              </section>

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
                  className="input rounded-xl"
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
                    className="input rounded-t-xl pr-24 tabular-nums"
                  />
                  {brand && (
                    <span className="pointer-events-none absolute top-1/2 right-3.5 z-10 -translate-y-1/2 text-xs font-semibold tracking-wide text-zinc-400">
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
                    className="input rounded-bl-xl tabular-nums"
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
                    className="input -ml-px rounded-br-xl tabular-nums"
                  />
                </div>
                {cardError && <p id="card-error" className="field-error">{cardError}</p>}
                {trial && !cardError && (
                  <p className="mt-1.5 text-[13px] text-zinc-500">
                    We&apos;ll check your card now but won&apos;t charge it until {trial.chargeOn}.
                  </p>
                )}
              </fieldset>

              <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-2.5">
                <p className="text-xs text-zinc-500">Test cards, click to fill</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TEST_CARDS.map((testCard) => (
                    <button
                      key={testCard.number}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => fillTestCard(testCard.number)}
                      className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-50"
                    >
                      <span className="font-mono">•••• {testCard.number.slice(-4)}</span>
                      <span className="text-zinc-500"> · {testCard.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {paymentError && (
                <div role="alert" className="animate-fade-in mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm">
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
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    {trial ? "Starting trial…" : "Processing…"}
                  </>
                ) : paymentError?.code === "PAYMENT_FAILED" ? (
                  "Try again"
                ) : trial ? (
                  "Start free trial"
                ) : (
                  `Pay ${price}`
                )}
              </button>
              <p className="mt-3 text-center text-[13px] text-zinc-500">
                {isProcessing
                  ? "Hang tight, this only takes a moment."
                  : trial
                    ? `${free} today. ${price} on ${trial.chargeOn} unless you cancel.`
                    : `${price} today, then every ${product.interval} until you cancel.`}
              </p>
            </div>
          </form>
        )}

        <footer className="flex items-center justify-center gap-1.5 border-t border-zinc-100 px-6 py-3.5 text-xs text-zinc-500">
          <Lock size={12} strokeWidth={2} />
          <span>
            Secured by Dodo Payments{product && <> · {product.merchant} never sees your card</>}
          </span>
        </footer>
      </div>
    </div>
  );
}
