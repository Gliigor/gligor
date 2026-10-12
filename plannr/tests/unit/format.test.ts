import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatEuro, formatPercent, parseDutchNumber } from "@/lib/format";

// Intl may use a narrow no-break space between "€" and the amount.
const norm = (s: string) => s.replace(/ | /g, " ");

test("formats euros the Dutch way", () => {
  assert.equal(norm(formatEuro(1250000)), "€ 1.250.000,00");
  assert.equal(norm(formatEuro(1250000, { whole: true })), "€ 1.250.000");
  assert.equal(formatEuro(null), "—");
});

test("formats dates in Europe/Amsterdam", () => {
  assert.equal(formatDate("2026-10-12T10:00:00Z"), "12-10-2026");
  assert.equal(formatDateTime("2026-10-12T12:35:00Z"), "12-10-2026, 14:35");
  assert.equal(formatDateTime("2026-01-05T08:05:00Z"), "05-01-2026, 09:05");
});

test("formats percentages", () => {
  assert.equal(norm(formatPercent(0.245)), "24,5%");
});

test("parses Dutch number input", () => {
  assert.equal(parseDutchNumber("1.250.000"), 1250000);
  assert.equal(parseDutchNumber("1250000,50"), 1250000.5);
  assert.equal(parseDutchNumber("€ 12.000,-"), 12000);
  assert.equal(parseDutchNumber("4,2"), 4.2);
  assert.equal(parseDutchNumber("100"), 100);
  assert.equal(parseDutchNumber(""), null);
  assert.ok(Number.isNaN(parseDutchNumber("abc")));
});

test("never prints a negative zero", () => {
  assert.equal(norm(formatEuro(-0, { whole: true })), "€ 0");
  assert.equal(norm(formatEuro(-0.2, { whole: true })), "€ 0");
});
