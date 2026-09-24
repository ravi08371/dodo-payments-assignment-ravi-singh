import type { Metadata } from "next";
import { PRODUCTS } from "@/lib/payment";
import Checkout from "./Checkout";

export const metadata: Metadata = { title: "Checkout — Dodo Payments" };

function parseOrigin(value: unknown) {
  try {
    return typeof value === "string" ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const { productId, origin } = await searchParams;
  const parentOrigin = parseOrigin(origin);

  if (!parentOrigin) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 p-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-semibold">Nothing to pay for here</h1>
          <p className="mt-2 text-sm text-zinc-500">
            This checkout opens from a store&apos;s website. Head back to the store and click Buy.
          </p>
        </div>
      </main>
    );
  }

  const product = typeof productId === "string" ? PRODUCTS[productId] ?? null : null;
  return <Checkout product={product} parentOrigin={parentOrigin} />;
}
