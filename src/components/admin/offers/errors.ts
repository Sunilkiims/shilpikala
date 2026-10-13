export const OFFER_ERRORS: Record<string, string> = {
  name_required: "Give the offer a campaign name, e.g. “Diwali Special Sale”.",
  name_too_long: "The campaign name is too long (120 characters max).",
  badge_too_long: "The badge text is too long (40 characters max).",
  invalid_scope: "Choose whether the offer is for specific products or a whole category.",
  invalid_discount_type: "Choose percentage or fixed amount.",
  discount_required: "Enter the discount value.",
  negative_discount: "A discount can't be negative.",
  invalid_discount: "Enter a valid number, with at most two decimal places (e.g. 20 or 150.50).",
  percent_too_high: "A percentage discount must be below 100%. Free products aren't supported.",
  discount_exceeds_price: "That discount would make the price zero or negative.",
  products_required: "Select at least one product.",
  too_many_products: "Too many products selected (500 max per offer).",
  product_not_found: "A selected product no longer exists.",
  category_required: "Choose a category.",
  category_not_found: "That category no longer exists.",
  invalid_start_date: "The start date isn't valid.",
  invalid_end_date: "The end date isn't valid.",
  end_before_start: "The end must be after the start.",
  end_in_past: "The end date has already passed.",
  not_found: "That offer no longer exists.",
};
export const offerError = (code?: string, products?: string[]) => {
  const base = (code && OFFER_ERRORS[code]) || "Something went wrong. Please try again.";
  return products?.length ? `${base} Affected: ${products.slice(0, 5).join(", ")}${products.length > 5 ? ` and ${products.length - 5} more` : ""}.` : base;
};
