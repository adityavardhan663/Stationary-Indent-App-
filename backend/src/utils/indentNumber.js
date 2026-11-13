// Generates human-friendly sequential indent numbers like IND-2026-000101
let counter = 100;

function generateIndentNumber() {
  counter += 1;
  const year = new Date().getFullYear();
  const sequence = String(counter).padStart(6, '0');
  return `IND-${year}-${sequence}`;
}

module.exports = { generateIndentNumber };
