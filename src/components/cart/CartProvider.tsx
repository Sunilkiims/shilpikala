"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { CartItem } from "@/types/catalog";
import type { CartPriceInfo } from "@/lib/offers/cartPrices";
import { paiseToRupees, parsePaise } from "@/lib/offers/money";
import { formatMoney } from "@/lib/utils/currency";

const STORAGE_KEY = "shilpikala:cart";

type CartState = {
  items: CartItem[];
  /** Human-readable "the price of X changed" messages from the last server price check. */
  notices: string[];
};

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; productId: number }
  | { type: "SET_QUANTITY"; productId: number; quantity: number }
  | { type: "CLEAR" }
  | { type: "SYNC_PRICES"; prices: CartPriceInfo[] }
  | { type: "HYDRATE"; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, items: action.items };

    case "SYNC_PRICES": {
      const byId = new Map(action.prices.map((p) => [p.productId, p]));
      const notices: string[] = [];
      const items = state.items.map((item) => {
        const info = byId.get(item.productId);
        if (!info) return item;
        if (!info.available || info.price === undefined) return { ...item, unavailable: true };
        const { originalPrice: _o, percentOff: _p, offerLabel: _l, unavailable: _u, ...rest } = item;
        void _o; void _p; void _l; void _u;
        const next: CartItem = {
          ...rest,
          price: info.price,
          ...(info.originalPrice ? { originalPrice: info.originalPrice } : {}),
          ...(info.percentOff ? { percentOff: info.percentOff } : {}),
          ...(info.label ? { offerLabel: info.label } : {}),
        };
        if (parsePaise(item.price) !== parsePaise(info.price)) {
          notices.push(`The price of ${item.name} is now ${formatMoney(info.price)} (was ${formatMoney(item.price)}).`);
        }
        return next;
      });
      return { items, notices };
    }

    case "ADD_ITEM": {
      const existing = state.items.find(
        (item) => item.productId === action.item.productId
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.productId === action.item.productId
              ? { ...action.item, quantity: Math.min(99, item.quantity + action.item.quantity) }
              : item
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }

    case "SET_QUANTITY": {
      const quantity = Math.max(1, Math.min(99, action.quantity));
      return {
        ...state,
        items: state.items.map((item) =>
          item.productId === action.productId ? { ...item, quantity } : item
        ),
      };
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.productId !== action.productId),
      };

    case "CLEAR":
      return { items: [], notices: [] };

    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  /** Exact sum of unit price x quantity (computed in paise). */
  subtotal: number;
  /** Total before offers, and what the offers save, for "You save" lines. */
  listSubtotal: number;
  savings: number;
  notices: string[];
  dismissNotices: () => void;
  /** Apply fresh server prices (used after checkout reports they changed). */
  applyPrices: (prices: CartPriceInfo[]) => void;
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], notices: [] });

  // Load any saved cart after mount only, so the server-rendered and
  // first-client-render HTML both start from an empty cart and match —
  // this update happens post-hydration, not during it.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const items = JSON.parse(raw) as CartItem[];
        dispatch({ type: "HYDRATE", items });
      }
    } catch {
      // Ignore a corrupted or inaccessible localStorage value.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Storage may be full or unavailable (e.g. private browsing) — the
      // cart still works for the session, it just won't persist.
    }
  }, [state.items]);

  // Ask the server what each item costs right now. The saved prices can be days old: an offer may have
  // started or ended since. Runs when the set of products changes (not on quantity changes).
  const idsKey = state.items.map((i) => i.productId).sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!idsKey) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/cart/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: idsKey.split(",").map(Number) }),
          signal: ctrl.signal,
        });
        if (res.ok) dispatch({ type: "SYNC_PRICES", prices: ((await res.json()) as { prices: CartPriceInfo[] }).prices });
      } catch {
        // Offline or aborted: keep showing the saved prices. Checkout re-prices on the server anyway.
      }
    })();
    return () => ctrl.abort();
  }, [idsKey]);

  const value = useMemo<CartContextValue>(() => {
    const totalQuantity = state.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const paise = (price: string) => parsePaise(price) ?? Math.round(Number(price) * 100);
    const subtotalPaise = state.items.reduce((sum, item) => sum + paise(item.price) * item.quantity, 0);
    const listPaise = state.items.reduce(
      (sum, item) => sum + paise(item.originalPrice ?? item.price) * item.quantity,
      0
    );
    const subtotal = paiseToRupees(subtotalPaise);

    return {
      items: state.items,
      totalQuantity,
      subtotal,
      listSubtotal: paiseToRupees(listPaise),
      savings: paiseToRupees(Math.max(0, listPaise - subtotalPaise)),
      notices: state.notices,
      dismissNotices: () => dispatch({ type: "SYNC_PRICES", prices: [] }),
      applyPrices: (prices) => dispatch({ type: "SYNC_PRICES", prices }),
      addItem: (item) => dispatch({ type: "ADD_ITEM", item }),
      removeItem: (productId) => dispatch({ type: "REMOVE_ITEM", productId }),
      setQuantity: (productId, quantity) =>
        dispatch({ type: "SET_QUANTITY", productId, quantity }),
      clear: () => dispatch({ type: "CLEAR" }),
    };
  }, [state.items, state.notices]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
