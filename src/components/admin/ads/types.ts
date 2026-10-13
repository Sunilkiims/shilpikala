export type PickerProduct = { id: number; name: string; price: string; image?: string };
export type PickerCategory = { id: number; name: string };
export type PickerCollection = { id: number; name: string };

export const AD_ERRORS: Record<string, string> = {
  name_required: "Give the advertisement an internal name.",
  invalid_type: "Choose an advertisement type.",
  invalid_placement: "That placement isn't available for this type.",
  heading_too_long: "The heading is too long (120 characters max).",
  subtitle_too_long: "The subtitle is too long (300 characters max).",
  badge_too_long: "The badge text is too long (40 characters max).",
  cta_too_long: "The button text is too long (30 characters max).",
  invalid_priority: "Priority must be a whole number between -1000 and 1000.",
  invalid_start_date: "The start date isn't valid.",
  invalid_end_date: "The end date isn't valid.",
  end_before_start: "The end must be after the start.",
  invalid_media: "One of the images isn't valid.",
  media_not_found: "An uploaded image is missing. Please upload it again.",
  media_required: "Upload at least a desktop or a mobile image before publishing (or save it as a draft).",
  invalid_destination: "Choose where the advertisement should lead.",
  product_not_found: "A selected product no longer exists.",
  category_not_found: "A selected category no longer exists.",
  collection_not_found: "A selected collection no longer exists.",
  products_required: "Select at least one product.",
  invalid_route: "Enter a page on this site starting with a single “/” (for example /shop). Admin and API pages aren't allowed.",
  invalid_url: "Enter a full web address starting with https:// (or http://).",
  invalid_source: "Choose which products the carousel shows.",
  invalid_max_items: "Number of products must be between 1 and 24.",
  not_found: "That advertisement no longer exists.",
  unsupported_file_type: "Only JPEG, PNG, WebP and GIF images are allowed.",
  file_too_large: "That file is too large. The limit is 4 MB.",
  empty_file: "That file is empty.",
};
export const adError = (code?: string) => (code && AD_ERRORS[code]) || "Something went wrong. Please try again.";
