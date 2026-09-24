"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Calendar, ChevronRight, CircleCheck, Home, Moon, Sparkles, Timer, Trophy, User } from "lucide-react";
import EventLog, { type LogEntry } from "./EventLog";
import Paywall from "./Paywall";

// Locally the checkout is served from 127.0.0.1 so it's a different origin from the store on localhost.
function getCheckoutUrl() {
  return process.env.NEXT_PUBLIC_CHECKOUT_URL || window.location.origin.replace("localhost", "127.0.0.1");
}

const nav = [
  { icon: Home, label: "Today" },
  { icon: CircleCheck, label: "Habits" },
  { icon: Timer, label: "Focus" },
  { icon: BarChart3, label: "Insights" },
  { icon: User, label: "You", active: true },
];

const stats = [
  { value: "0d", label: "Current streak" },
  { value: "0", label: "Habits done" },
  { value: "0h", label: "Focused" },
];

const links = [
  { icon: Calendar, label: "Calendar" },
  { icon: Moon, label: "Daily summary" },
  { icon: Trophy, label: "Achievements" },
];

export default function DemoStore() {
  const [sdkStatus, setSdkStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [proPlan, setProPlan] = useState<string | null>(null);
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
      onSuccess: (data) => {
        log("onSuccess", "success", data);
        // A real app would confirm the session on its server before unlocking anything.
        setProPlan(productId === "prod_grit_monthly" ? "Monthly" : "Yearly · free trial");
      },
      onError: (data) => log("onError", "error", data),
      onClose: (data) => {
        log("onClose", "neutral", data);
        setIsCheckoutOpen(false);
        if (data.reason === "success") setIsPaywallOpen(false);
      },
    });
    if (opened) setIsCheckoutOpen(true);
    log(opened ? "open()" : "open() ignored, checkout already open", "neutral", { productId });
  }

  return (
    <div className="min-h-screen bg-[#f7f6fc] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-r border-violet-100/70 bg-gradient-to-b from-sky-50/60 to-transparent px-4 py-5 lg:sticky lg:top-0 lg:h-screen lg:py-8">
        <div className="flex items-center gap-3 px-3">
          <span className="size-8 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
          <span className="text-xl font-bold tracking-tight">Grit</span>
        </div>
        <nav className="mt-8 hidden space-y-1 lg:block">
          {nav.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium ${
                active ? "bg-violet-100/80 text-violet-700" : "text-zinc-500"
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </div>
          ))}
        </nav>
      </aside>

      <div className="grid gap-10 px-5 py-8 sm:px-10 lg:py-12 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="mx-auto w-full max-w-xl">
          <h1 className="text-4xl font-extrabold tracking-tight">You</h1>

          <div className="mt-8 flex items-center gap-6">
            <div className="relative rounded-full bg-white p-1.5 shadow-sm ring-1 ring-zinc-100">
              <div className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-4xl font-bold">
                R
              </div>
              <span className="absolute -right-1 bottom-1 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white ring-2 ring-white">
                Lv 1
              </span>
            </div>
            <div>
              <p className="flex items-center gap-2 text-3xl font-bold">
                Ravi
                {proPlan && (
                  <span className="rounded-full bg-violet-500 px-2.5 py-0.5 text-xs font-bold text-white">PRO</span>
                )}
              </p>
              <p className="mt-1 text-lg text-zinc-500">Seedling</p>
              <p className="text-zinc-500">Growing since September 2026</p>
            </div>
          </div>

          {proPlan ? (
            <div className="animate-fade-in mt-8 flex items-center gap-4 rounded-3xl bg-emerald-50 p-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-emerald-500 text-white">
                <Sparkles size={22} />
              </span>
              <div className="flex-1">
                <p className="text-lg font-bold">You&apos;re on Grit Pro</p>
                <p className="text-zinc-600">{proPlan}</p>
              </div>
              <button
                onClick={() => setProPlan(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-emerald-100 hover:text-ink"
              >
                Reset demo
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsPaywallOpen(true)}
              className="mt-8 flex w-full items-center gap-4 rounded-3xl bg-violet-100/70 p-5 text-left transition hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-violet-400 text-ink">
                <Sparkles size={22} />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-bold">Try Pro</span>
                <span className="block text-zinc-600">Unlimited habits, every theme and more.</span>
              </span>
              <ChevronRight className="text-violet-600" />
            </button>
          )}

          <dl className="mt-8 grid grid-cols-3 border-y border-zinc-200 py-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="text-3xl font-extrabold">{stat.value}</dd>
                <dt className="mt-1 text-zinc-500">{stat.label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-8 divide-y divide-zinc-100 rounded-3xl border border-zinc-100 bg-white">
            {links.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-4 px-6 py-5 text-lg font-medium">
                <Icon size={22} strokeWidth={1.75} />
                <span className="flex-1">{label}</span>
                <ChevronRight size={20} className="text-zinc-400" />
              </div>
            ))}
          </div>
        </main>

        <aside className="space-y-6 xl:sticky xl:top-12 xl:self-start">
          <EventLog entries={entries} onClear={() => setEntries([])} />

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm">
            <h2 className="font-semibold">Try it</h2>
            <ul className="mt-3 space-y-1.5 text-zinc-600">
              <li><code className="font-mono text-ink">4242 4242 4242 4242</code> succeeds</li>
              <li><code className="font-mono text-ink">4000 0000 0000 0002</code> is declined</li>
              <li><code className="font-mono text-ink">4000 0000 0000 0341</code> fails once, then succeeds on retry</li>
            </ul>
            <p className="mt-3 text-zinc-500">Any future expiry date and any 3-digit CVC.</p>

            <h3 className="mt-6 font-semibold">Edge cases</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => openCheckout("prod_missing")}
                disabled={sdkStatus !== "ready"}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Open an unknown product
              </button>
              <button
                onClick={() => {
                  openCheckout("prod_grit_monthly");
                  openCheckout("prod_grit_monthly");
                }}
                disabled={sdkStatus !== "ready"}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Call open() twice
              </button>
            </div>
          </section>
        </aside>
      </div>

      {isPaywallOpen && (
        <Paywall
          canCheckout={sdkStatus === "ready"}
          sdkFailed={sdkStatus === "failed"}
          isCheckoutOpen={isCheckoutOpen}
          onContinue={openCheckout}
          onClose={() => setIsPaywallOpen(false)}
        />
      )}
    </div>
  );
}
