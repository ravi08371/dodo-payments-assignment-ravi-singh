export type Product = {
  merchant: string;
  name: string;
  plan: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  trialDays?: number;
};

// Stand-in for a product lookup on a real backend.
export const PRODUCTS: Record<string, Product> = {
  prod_grit_yearly: {
    merchant: "Grit",
    name: "Grit Pro",
    plan: "Yearly",
    amount: 69900,
    currency: "INR",
    interval: "year",
    trialDays: 7,
  },
  prod_grit_monthly: {
    merchant: "Grit",
    name: "Grit Pro",
    plan: "Monthly",
    amount: 9900,
    currency: "INR",
    interval: "month",
  },
};

export const TEST_CARDS = [
  { number: "4242424242424242", label: "Succeeds" },
  { number: "4000000000000002", label: "Declines" },
  { number: "4000000000000341", label: "Fails once" },
];

export function formatAmount(amount: number, currency: string) {
  const digits = amount % 100 ? 2 : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 100);
}

const DAY = 24 * 60 * 60 * 1000;

// Fixed time zone so the server render and the browser agree on the date.
function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export function getTrialDates(trialDays: number) {
  const chargeOn = Date.now() + trialDays * DAY;
  return { chargeOn: formatDay(new Date(chargeOn)), remindOn: formatDay(new Date(chargeOn - 2 * DAY)) };
}

export function isValidCardNumber(digits: string) {
  if (digits.length !== 16) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let n = Number(digits[15 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

export type PaymentResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: "PAYMENT_DECLINED" | "PAYMENT_FAILED"; message: string };

// Lives as long as the checkout iframe does, so "fails once" means once per checkout session.
let hasFailedOnce = false;

export async function fakePay(cardNumber: string): Promise<PaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, 1600));

  // Toggle "Offline" in DevTools while it's processing to simulate the connection dropping mid-payment.
  if (!navigator.onLine) {
    return { ok: false, code: "PAYMENT_FAILED", message: "The connection was lost while processing your payment." };
  }

  if (cardNumber === "4000000000000002") {
    return { ok: false, code: "PAYMENT_DECLINED", message: "Your card was declined." };
  }
  if (cardNumber === "4000000000000341" && !hasFailedOnce) {
    hasFailedOnce = true;
    return {
      ok: false,
      code: "PAYMENT_FAILED",
      message: "Something went wrong while processing your payment.",
    };
  }
  return { ok: true, sessionId: "cs_" + crypto.randomUUID().replaceAll("-", "").slice(0, 24) };
}
