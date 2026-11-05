/** All money is stored as integer cents to avoid floating point errors. */
function calculateTotals(subtotalCents, config) {
  const shipping = subtotalCents === 0 || subtotalCents >= config.freeShippingOverCents ? 0 : config.shippingFlatCents;
  const tax = Math.round(subtotalCents * config.taxRate);
  return { subtotal: subtotalCents, shipping, tax, total: subtotalCents + shipping + tax };
}

/** Luhn checksum, used only to validate the simulated card number format. */
function luhnValid(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

module.exports = { calculateTotals, luhnValid };
