export type Product = {
  merchant: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval?: "month" | "year";
};

// Stand-in for a product lookup on a real backend.
export const PRODUCTS: Record<string, Product> = {
  prod_123: {
    merchant: "Grit",
    name: "Grit Pro",
    description: "Unlimited projects, priority support and advanced analytics.",
    amount: 2900,
    currency: "USD",
    interval: "month",
  },
};

export const TEST_CARDS = [
  { number: "4242424242424242", label: "Succeeds" },
  { number: "4000000000000002", label: "Declines" },
  { number: "4000000000000341", label: "Fails once" },
];

export function formatAmount(product: Product) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(
    product.amount / 100,
  );
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
