"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Download, Leaf, Palette, Shield, Sparkles, Sprout, Timer, X } from "lucide-react";
import { getTrialDates } from "@/lib/payment";

const features = [
  { icon: Leaf, label: "Unlimited habits" },
  { icon: Palette, label: "All 8 themes" },
  { icon: Timer, label: "Deep focus sessions + ambient sounds" },
  { icon: BarChart3, label: "Full insights & mood patterns" },
  { icon: Download, label: "Data export" },
  { icon: Shield, label: "4 rest days a month" },
];

const plans = [
  { productId: "prod_grit_yearly", name: "Yearly", price: "₹699 / year", note: "≈ ₹58 / month", trial: true },
  { productId: "prod_grit_monthly", name: "Monthly", price: "₹99 / month", note: "Billed monthly", trial: false },
];

type Props = {
  canCheckout: boolean;
  sdkFailed: boolean;
  isCheckoutOpen: boolean;
  onContinue: (productId: string) => void;
  onClose: () => void;
};

export default function Paywall({ canCheckout, sdkFailed, isCheckoutOpen, onContinue, onClose }: Props) {
  const [productId, setProductId] = useState(plans[0].productId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const plan = plans.find((p) => p.productId === productId)!;
  const { chargeOn } = getTrialDates(7);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    return () => {
      document.documentElement.style.overflow = "";
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // While the checkout is on top, Escape belongs to it.
      if (isCheckoutOpen || !dialogRef.current) return;
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:checked");
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
  }, [isCheckoutOpen, onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="animate-panel-in relative grid max-h-[calc(100dvh-12px)] w-full overflow-y-auto rounded-t-3xl bg-gradient-to-br from-sky-50 via-white to-violet-50 shadow-2xl shadow-ink/20 sm:max-h-[calc(100dvh-48px)] sm:max-w-4xl sm:rounded-3xl md:grid-cols-2"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 z-10 grid size-10 place-items-center rounded-full bg-white text-ink shadow-sm transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-violet-500"
        >
          <X size={20} />
        </button>

        <div className="px-6 pt-8 pb-6 sm:px-8 md:px-10 md:pt-10 md:pb-10">
          <div className="relative mx-auto grid size-18 place-items-center md:size-24 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-lg shadow-violet-500/25">
            <Sprout size={40} strokeWidth={1.75} />
            <Sparkles size={18} className="absolute -top-1 -right-3 text-amber-400" />
          </div>
          <h2 id="paywall-title" className="mt-5 text-center text-3xl font-extrabold md:text-4xl tracking-tight text-ink">
            Grit Pro
          </h2>
          <p className="mt-2 text-center text-lg text-zinc-500">Keep going, a little further.</p>
          <ul className="mt-6 space-y-2.5 md:mt-8 md:space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4 text-[17px] text-ink">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-100/70 text-violet-600">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-center px-6 pb-8 sm:px-8 md:px-10 md:pt-20 md:pb-10">
          <fieldset>
            <legend className="mb-4 text-[15px] font-medium text-zinc-600">Choose your plan</legend>
            <div className="space-y-3">
              {plans.map((p) => (
                <label
                  key={p.productId}
                  className="flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-zinc-100 bg-white px-4 py-4 sm:px-5 transition has-checked:border-violet-400 has-focus-visible:ring-4 has-focus-visible:ring-violet-500/20 hover:border-violet-200"
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.productId}
                    checked={productId === p.productId}
                    onChange={() => setProductId(p.productId)}
                    className="peer sr-only"
                  />
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-zinc-300 text-white peer-checked:border-violet-500 peer-checked:bg-violet-500">
                    <Check size={16} strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {p.trial && (
                      <span className="mb-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white">7-day free trial</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-violet-700">Best value</span>
                      </span>
                    )}
                    <span className="block text-lg font-semibold text-ink">{p.name}</span>
                    <span className="block text-sm text-zinc-500">{p.note}</span>
                  </span>
                  <span className="text-right text-lg font-bold whitespace-nowrap text-ink">{p.price}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            onClick={() => onContinue(productId)}
            disabled={!canCheckout}
            className="btn-primary mt-8 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {sdkFailed
              ? "Checkout unavailable"
              : !canCheckout
                ? "Loading checkout…"
                : plan.trial
                  ? "Start 7-day free trial"
                  : "Continue with Monthly"}
          </button>
          {sdkFailed ? (
            <p role="alert" className="mt-3 text-center text-sm text-red-600">
              We couldn&apos;t load the checkout. Check your connection and refresh the page.
            </p>
          ) : (
            <p className="mt-3 text-center text-sm text-zinc-500">
              {plan.trial
                ? `₹0 today. ₹699/year from ${chargeOn}, and we'll remind you 2 days before. Cancel anytime.`
                : "₹99 today, then every month. Cancel anytime."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
