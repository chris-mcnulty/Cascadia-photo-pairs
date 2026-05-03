import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string;
  mediaType: string; // e.g. "ChromaLuxe"
  sizeLabel: string; // e.g. "12 X 8"
  productSizeId?: string;
  unitPriceCents: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  itemKey: (item: Pick<CartItem, "productId" | "mediaType" | "sizeLabel">) => string;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "cmn-public-cart-v1";

export function itemKey(item: Pick<CartItem, "productId" | "mediaType" | "sizeLabel">) {
  return `${item.productId}::${item.mediaType}::${item.sizeLabel}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch (err) {
      console.warn("Cart: could not load saved items from localStorage", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn("Cart: could not persist items to localStorage", err);
    }
  }, [items]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const key = itemKey(item);
      const idx = prev.findIndex((i) => itemKey(i) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (key: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (itemKey(i) === key ? { ...i, quantity: Math.max(0, qty) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => itemKey(i) !== key));
  };

  const clear = () => setItems([]);

  const count = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotalCents = items.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);

  return (
    <CartContext.Provider
      value={{ items, count, subtotalCents, addItem, updateQuantity, removeItem, clear, itemKey }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
