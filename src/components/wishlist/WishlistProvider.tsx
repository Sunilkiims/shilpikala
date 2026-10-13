"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { AUTH_CHANGE_EVENT } from "@/components/account/authEvents";

const STORAGE_KEY = "shilpikala:wishlist";

type WishlistState = {
  productIds: number[];
};

type WishlistAction =
  | { type: "TOGGLE"; productId: number }
  | { type: "REMOVE"; productId: number }
  | { type: "HYDRATE"; productIds: number[] };

function wishlistReducer(state: WishlistState, action: WishlistAction): WishlistState {
  switch (action.type) {
    case "HYDRATE":
      return { productIds: action.productIds };

    case "TOGGLE":
      return state.productIds.includes(action.productId)
        ? { productIds: state.productIds.filter((id) => id !== action.productId) }
        : { productIds: [...state.productIds, action.productId] };

    case "REMOVE":
      return { productIds: state.productIds.filter((id) => id !== action.productId) };

    default:
      return state;
  }
}

type WishlistContextValue = {
  productIds: number[];
  count: number;
  isWishlisted: (productId: number) => boolean;
  toggle: (productId: number) => void;
  remove: (productId: number) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

async function api(method: string, path: string, body?: unknown): Promise<number[] | "unauthorized" | "error"> {
  try {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) return "unauthorized";
    if (!response.ok) return "error";
    return ((await response.json()) as { productIds: number[] }).productIds;
  } catch {
    return "error";
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wishlistReducer, { productIds: [] });
  // Signed-in customers keep their wishlist on the server; guests keep it in localStorage.
  const signedIn = useRef(false);
  const latest = useRef<number[]>([]);

  // Keep a ref copy for async callbacks. Declared before the mount effect so the
  // mount effect's own assignment (from localStorage) is not overwritten by the empty initial state.
  useEffect(() => {
    latest.current = state.productIds;
  }, [state.productIds]);

  /** Merges anything saved while signed out into the account and adopts the server's list. */
  const sync = useCallback(async () => {
    const result = await api("GET", "/api/account/wishlist");
    if (result === "unauthorized") {
      signedIn.current = false;
      return;
    }
    if (result === "error") return;
    signedIn.current = true;
    const extra = latest.current.filter((id) => !result.includes(id));
    const merged = extra.length ? await api("POST", "/api/account/wishlist", { productIds: extra }) : result;
    if (Array.isArray(merged)) dispatch({ type: "HYDRATE", productIds: merged });
  }, []);

  // Same pattern as CartProvider: start empty on both server and first
  // client render (so they match), then load the real value after
  // mount — avoids a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const productIds = JSON.parse(raw) as number[];
        latest.current = productIds;
        dispatch({ type: "HYDRATE", productIds });
      }
    } catch {
      // Ignore a corrupted or inaccessible localStorage value.
    }
    void sync();
    const onAuth = (event: Event) => {
      if ((event as CustomEvent).detail === "logout") {
        // Don't leave the previous customer's list on a shared device.
        signedIn.current = false;
        latest.current = [];
        dispatch({ type: "HYDRATE", productIds: [] });
      } else {
        void sync();
      }
    };
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
  }, [sync]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.productIds));
    } catch {
      // Storage may be full or unavailable — wishlist still works for
      // the session, it just won't persist.
    }
  }, [state.productIds]);

  const value = useMemo<WishlistContextValue>(() => {
    const persist = async (call: () => ReturnType<typeof api>) => {
      if (!signedIn.current) return;
      const result = await call();
      if (Array.isArray(result)) return;
      void sync(); // the server said no (or was unreachable): fall back to its truth
    };
    return {
      productIds: state.productIds,
      count: state.productIds.length,
      isWishlisted: (productId) => state.productIds.includes(productId),
      toggle: (productId) => {
        const adding = !state.productIds.includes(productId);
        dispatch({ type: "TOGGLE", productId });
        void persist(() =>
          adding
            ? api("POST", "/api/account/wishlist", { productId })
            : api("DELETE", `/api/account/wishlist/${productId}`)
        );
      },
      remove: (productId) => {
        dispatch({ type: "REMOVE", productId });
        void persist(() => api("DELETE", `/api/account/wishlist/${productId}`));
      },
    };
  }, [state.productIds, sync]);

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
