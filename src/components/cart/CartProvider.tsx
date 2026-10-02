"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { CartItem } from "@/types/catalog";

const STORAGE_KEY = "shilpikala:cart";

type CartState = {
  items: CartItem[];
};

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; productId: number }
  | { type: "SET_QUANTITY"; productId: number; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items };

    case "ADD_ITEM": {
      const existing = state.items.find(
        (item) => item.productId === action.item.productId
      );
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === action.item.productId
              ? { ...item, quantity: item.quantity + action.item.quantity }
              : item
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }

    case "SET_QUANTITY": {
      const quantity = Math.max(1, Math.min(99, action.quantity));
      return {
        items: state.items.map((item) =>
          item.productId === action.productId ? { ...item, quantity } : item
        ),
      };
    }

    case "REMOVE_ITEM":
      return {
        items: state.items.filter((item) => item.productId !== action.productId),
      };

    case "CLEAR":
      return { items: [] };

    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

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

  const value = useMemo<CartContextValue>(() => {
    const totalQuantity = state.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const subtotal = state.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    return {
      items: state.items,
      totalQuantity,
      subtotal,
      addItem: (item) => dispatch({ type: "ADD_ITEM", item }),
      removeItem: (productId) => dispatch({ type: "REMOVE_ITEM", productId }),
      setQuantity: (productId, quantity) =>
        dispatch({ type: "SET_QUANTITY", productId, quantity }),
      clear: () => dispatch({ type: "CLEAR" }),
    };
  }, [state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
