"use client";

import { useEffect, useRef, useState } from "react";
import EventLog, { type LogEntry } from "./EventLog";

// Locally the checkout is served from 127.0.0.1 so it's a different origin from the store on localhost.
function getCheckoutUrl() {
  return process.env.NEXT_PUBLIC_CHECKOUT_URL || window.location.origin.replace("localhost", "127.0.0.1");
}

const features = ["Unlimited projects", "Priority support", "Advanced analytics", "Cancel anytime"];

export default function DemoStore() {
  const [sdkStatus, setSdkStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  function log(name: string, tone: LogEntry["tone"], payload?: unknown) {
    const time = new Date().toLocaleTimeString("en-GB");
    setEntries((prev) => [{ id: nextId.current++, time, name, tone, payload }, ...prev]);
  }

  // Same as a merchant adding <script src=".../dodo-checkout.js"> to their page.
  useEffect(() => {
    if (document.getElementById("dodo-sdk")) return;
    const script = document.createElement("script");
    script.id = "dodo-sdk";
    script.src = `${getCheckoutUrl()}/dodo-checkout.js`;
    script.onload = () => setSdkStatus("ready");
    script.onerror = () => setSdkStatus("failed");
    document.body.appendChild(script);
  }, []);

  function openCheckout(productId: string) {
    const opened = window.DodoCheckout!.open({
      productId,
      onSuccess: (data) => log("onSuccess", "success", data),
      onError: (data) => log("onError", "error", data),
      onClose: (data) => log("onClose", "neutral", data),
    });
    log(opened ? "open()" : "open() ignored, checkout already open", "neutral", { productId });
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-6">
          <div className="grid size-7 place-items-center rounded-lg bg-zinc-900 text-[13px] font-semibold text-white">A</div>
          <span className="font-semibold">Grit</span>
          <span className="ml-auto rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500">
            Dodo Checkout
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_380px] lg:py-16">
        <div>
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="grid h-48 place-items-center bg-[radial-gradient(circle_at_30%_20%,#e0e7ff,transparent_60%),radial-gradient(circle_at_80%_80%,#fce7f3,transparent_55%)] bg-zinc-100">
              <span className="rounded-xl bg-white/80 px-4 py-2 text-lg font-semibold tracking-tight shadow-sm backdrop-blur">
                Grit Pro
              </span>
            </div>
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-semibold tracking-tight">Grit Pro Subscription</h1>
              <p className="mt-2 max-w-md text-zinc-600">
                Everything in Grit, without limits. For teams who ship every day.
              </p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">$29.00</span>
                <span className="text-zinc-500">/ month</span>
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span> {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openCheckout("prod_123")}
                disabled={sdkStatus !== "ready"}
                className="mt-8 h-12 w-full rounded-lg bg-zinc-900 px-8 font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto"
              >
                {sdkStatus === "loading" ? "Loading…" : sdkStatus === "failed" ? "Checkout unavailable" : "Buy now"}
              </button>
              {sdkStatus === "failed" && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  We couldn&apos;t load the checkout. Check your connection and refresh the page.
                </p>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm sm:p-8">
            <h2 className="font-semibold">Try it</h2>
            <ul className="mt-3 space-y-1.5 text-zinc-600">
              <li><code className="font-mono text-zinc-900">4242 4242 4242 4242</code> succeeds</li>
              <li><code className="font-mono text-zinc-900">4000 0000 0000 0002</code> is declined</li>
              <li><code className="font-mono text-zinc-900">4000 0000 0000 0341</code> fails once, then succeeds on retry</li>
            </ul>
            <p className="mt-3 text-zinc-500">Any future expiry date and any 3-digit CVC.</p>

            <h3 className="mt-6 font-semibold">Edge cases</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => openCheckout("prod_missing")}
                disabled={sdkStatus !== "ready"}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Open an unknwn product
              </button>
              <button
                onClick={() => {
                  openCheckout("prod_123");
                  openCheckout("prod_123");
                }}
                disabled={sdkStatus !== "ready"}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Call open() twice
              </button>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <EventLog entries={entries} onClear={() => setEntries([])} />
        </aside>
      </main>
    </div>
  );
}
