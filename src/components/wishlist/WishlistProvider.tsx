"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

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

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wishlistReducer, { productIds: [] });

  // Same pattern as CartProvider: start empty on both server and first
  // client render (so they match), then load the real value after
  // mount — avoids a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const productIds = JSON.parse(raw) as number[];
        dispatch({ type: "HYDRATE", productIds });
      }
    } catch {
      // Ignore a corrupted or inaccessible localStorage value.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.productIds));
    } catch {
      // Storage may be full or unavailable — wishlist still works for
      // the session, it just won't persist.
    }
  }, [state.productIds]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      productIds: state.productIds,
      count: state.productIds.length,
      isWishlisted: (productId) => state.productIds.includes(productId),
      toggle: (productId) => dispatch({ type: "TOGGLE", productId }),
      remove: (productId) => dispatch({ type: "REMOVE", productId }),
    }),
    [state.productIds]
  );

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
