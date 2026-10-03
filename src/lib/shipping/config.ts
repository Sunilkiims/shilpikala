/**
 * Flat-rate shipping with a free-shipping threshold. Plain numbers, no
 * logic — safe to import from both server and client code. Edit the
 * values here to change rates; nothing else needs to change.
 */
export const shippingConfig = {
  flatRateInRupees: 150,
  freeShippingThresholdInRupees: 5000,
};
