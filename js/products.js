// SABR Watches - Products Configuration
// Hardcoded dummy data removed. All products are dynamically loaded from MongoDB backend.
const PRODUCTS_DATA = [];

// Neutral "image unavailable" tile. Deliberately NOT a watch photo: a missing
// image must never masquerade as another product's picture.
var AMC_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Crect width='240' height='240' fill='%230F172A'/%3E%3Ccircle cx='120' cy='126' r='52' fill='none' stroke='%23C9A96E' stroke-width='5'/%3E%3Cpath d='M120 96v32l20 12' fill='none' stroke='%23C9A96E' stroke-width='5' stroke-linecap='round'/%3E%3Ctext x='120' y='206' fill='%236B7280' font-family='sans-serif' font-size='13' text-anchor='middle'%3EImage unavailable%3C/text%3E%3C/svg%3E";

// Watch image URL helper
function getWatchImage(url) {
  return url || AMC_IMAGE_PLACEHOLDER;
}

// Money helper — a missing or zero price must never be shown as ₹0, because that
// reads as a real (free) price. Legacy rows can still have a blank price.
function formatINR(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `₹${n.toLocaleString('en-IN')}` : 'Price on request';
}
