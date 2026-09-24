type CloseReason = "user" | "success" | "error";

type CheckoutErrorCode =
  | "PAYMENT_DECLINED"
  | "PAYMENT_FAILED"
  | "PRODUCT_NOT_FOUND"
  | "CHECKOUT_UNAVAILABLE";

interface CheckoutOptions {
  productId: string;
  onSuccess?: (data: { sessionId: string }) => void;
  onClose?: (data: { reason: CloseReason }) => void;
  onError?: (data: { code: CheckoutErrorCode; message: string }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- global augmentation
interface Window {
  DodoCheckout?: { open: (options: CheckoutOptions) => boolean };
}

(function () {
  if (window.DodoCheckout) return;

  // The SDK is served from the checkout's own domain, so that's where the checkout lives.
  const script = document.currentScript as HTMLScriptElement | null;
  const CHECKOUT_ORIGIN = script ? new URL(script.src).origin : window.location.origin;
  const LOAD_TIMEOUT = 10000;
  const CLOSE_REASONS: CloseReason[] = ["user", "success", "error"];
  const ERROR_CODES: CheckoutErrorCode[] = ["PAYMENT_DECLINED", "PAYMENT_FAILED", "PRODUCT_NOT_FOUND"];

  let isOpen = false;

  const style = document.createElement("style");
  style.textContent = `
    .dodo-overlay { position: fixed; inset: 0; z-index: 2147483647; background: rgba(9, 9, 11, 0.5); opacity: 0; transition: opacity 200ms ease; }
    .dodo-overlay.is-visible { opacity: 1; }
    .dodo-overlay iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; opacity: 0; transition: opacity 150ms ease; }
    .dodo-overlay.is-ready iframe { opacity: 1; }
    .dodo-spinner { position: absolute; top: 50%; left: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border: 2.5px solid rgba(255, 255, 255, 0.35); border-top-color: #fff; border-radius: 50%; animation: dodo-spin 0.7s linear infinite; }
    .dodo-overlay.is-ready .dodo-spinner { display: none; }
    @keyframes dodo-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .dodo-overlay, .dodo-overlay iframe { transition: none; } }
  `;

  function call<T>(callback: ((data: T) => void) | undefined, data: T) {
    // A throwing merchant callback shouldn't leave the overlay stuck on the page.
    try {
      callback?.(data);
    } catch (error) {
      console.error("[DodoCheckout] Error in callback:", error);
    }
  }

  function open(options: CheckoutOptions): boolean {
    if (!options || typeof options.productId !== "string" || !options.productId) {
      throw new Error("[DodoCheckout] open() needs a productId.");
    }
    if (isOpen) return false;
    isOpen = true;

    if (!style.isConnected) document.head.appendChild(style);

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const overlay = document.createElement("div");
    overlay.className = "dodo-overlay";
    overlay.innerHTML = '<div class="dodo-spinner" role="status" aria-label="Loading checkout"></div>';

    const url = new URL("/checkout", CHECKOUT_ORIGIN);
    url.searchParams.set("productId", options.productId);
    url.searchParams.set("origin", window.location.origin);

    const iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.title = "Dodo Payments checkout";
    iframe.allow = "payment";
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));

    let isReady = false;
    const timeout = window.setTimeout(() => {
      call(options.onError, {
        code: "CHECKOUT_UNAVAILABLE",
        message: "Checkout couldn't be loaded. Please try again.",
      });
      close("error");
    }, LOAD_TIMEOUT);

    function onMessage(event: MessageEvent) {
      if (event.origin !== CHECKOUT_ORIGIN || event.source !== iframe.contentWindow) return;
      const message = event.data;
      if (!message || message.source !== "dodo-checkout") return;

      // Copy out only the fields we expect, never pass the raw message to the host.
      if (message.type === "ready" && !isReady) {
        isReady = true;
        window.clearTimeout(timeout);
        overlay.classList.add("is-ready");
        iframe.focus();
      } else if (message.type === "success") {
        call(options.onSuccess, { sessionId: String(message.sessionId) });
      } else if (message.type === "error" && ERROR_CODES.includes(message.code)) {
        call(options.onError, { code: message.code, message: String(message.message) });
      } else if (message.type === "close") {
        close(CLOSE_REASONS.includes(message.reason) ? message.reason : "user");
      }
    }

    // Once the checkout is ready it handles Escape itself. This covers the loading spinner.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isReady) close("user");
    }

    let isClosed = false;
    function close(reason: CloseReason) {
      if (isClosed) return;
      isClosed = true;
      isOpen = false;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKeyDown);

      // Restore scroll before the callback runs, so the host can change it again in onClose.
      document.documentElement.style.overflow = previousOverflow;
      overlay.classList.remove("is-visible");
      window.setTimeout(() => {
        overlay.remove();
        previousFocus?.focus();
      }, 200);

      call(options.onClose, { reason });
    }

    window.addEventListener("message", onMessage);
    document.addEventListener("keydown", onKeyDown);
    return true;
  }

  window.DodoCheckout = { open };
})();
