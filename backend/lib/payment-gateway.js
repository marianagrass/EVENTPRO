/* ==========================================================
   lib/payment-gateway.js — Pasarela de pago SIMULADA
   No mueve dinero real ni guarda datos de tarjeta: solo valida el formato, decide "aprobado/rechazado"
   con reglas de prueba y devuelve lo único que se guarda (marca y últimos 4 dígitos).
   Cuando conectes una pasarela real (Wompi, PayU, Stripe…) solo se reemplaza este archivo:
   mantén las funciones authorize() y voidAuthorization().

   Datos de prueba
     Tarjeta aprobada : 4242 4242 4242 4242 (cualquier fecha futura y CVV de 3 dígitos)
     Tarjeta rechazada: 4000 0000 0000 0002 (fondos insuficientes)
     Nequi            : 3001234567 aprobado · número que termine en 0000 → rechazado
     PSE              : cualquier banco de la lista
   ========================================================== */
const crypto = require("crypto");

const PSE_BANKS = ["Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Banco Popular", "Nequi", "Banco Agrario"];

class GatewayError extends Error {
  constructor(message, { status = 402, code = "PAYMENT_DECLINED", fields = null } = {}) {
    super(message); this.name = "GatewayError"; this.status = status; this.code = code; this.fields = fields;
  }
}

function luhn(digits) {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

function cardBrand(n) {
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "American Express";
  return "Tarjeta";
}

function validateCard({ number, name, exp, cvv }, now = new Date()) {
  const fields = {};
  const digits = String(number || "").replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits) || !luhn(digits)) fields.number = "El número de tarjeta no es válido.";
  if (!String(name || "").trim() || String(name).trim().length < 3) fields.name = "Escribe el nombre como aparece en la tarjeta.";
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(exp || ""));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) fields.exp = "Usa el formato MM/AA.";
  else {
    const year = 2000 + Number(m[2]), month = Number(m[1]);
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) fields.exp = "La tarjeta está vencida.";
  }
  if (!/^\d{3,4}$/.test(String(cvv || ""))) fields.cvv = "El CVV tiene 3 o 4 dígitos.";
  return { fields, digits };
}

/**
 * Autoriza un cobro. Devuelve { approvalId, method, brand, last4 } o lanza GatewayError.
 * Nunca devuelve ni registra el número completo ni el CVV.
 */
function authorize({ type, amount, ...data }) {
  if (amount <= 0) return { approvalId: "FREE", method: "gratis", brand: null, last4: null };

  if (type === "tarjeta") {
    const { fields, digits } = validateCard(data);
    if (Object.keys(fields).length) throw new GatewayError("Revisa los datos de la tarjeta.", { status: 422, code: "VALIDATION", fields });
    if (digits.endsWith("0002")) throw new GatewayError("Pago rechazado: fondos insuficientes.");
    return { approvalId: "SIM-" + crypto.randomBytes(5).toString("hex"), method: "tarjeta", brand: cardBrand(digits), last4: digits.slice(-4) };
  }
  if (type === "nequi") {
    const phone = String(data.phone || "").replace(/\D/g, "");
    if (!/^3\d{9}$/.test(phone)) throw new GatewayError("Escribe un celular válido de 10 dígitos.", { status: 422, code: "VALIDATION", fields: { phone: "Celular inválido." } });
    if (phone.endsWith("0000")) throw new GatewayError("Pago rechazado por Nequi.");
    return { approvalId: "SIM-" + crypto.randomBytes(5).toString("hex"), method: "nequi", brand: "Nequi", last4: phone.slice(-4) };
  }
  if (type === "pse") {
    if (!PSE_BANKS.includes(data.bank)) throw new GatewayError("Elige tu banco.", { status: 422, code: "VALIDATION", fields: { bank: "Elige un banco de la lista." } });
    return { approvalId: "SIM-" + crypto.randomBytes(5).toString("hex"), method: "pse", brand: data.bank, last4: null };
  }
  throw new GatewayError("Elige un método de pago.", { status: 422, code: "VALIDATION", fields: { type: "Método no válido." } });
}

/** Anula una autorización (se usa si la base rechaza la compra después de aprobar el cobro). */
function voidAuthorization(approvalId) {
  return { voided: true, approvalId };
}

module.exports = { authorize, voidAuthorization, validateCard, cardBrand, luhn, GatewayError, PSE_BANKS };
