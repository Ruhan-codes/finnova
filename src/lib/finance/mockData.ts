import type { Alert, Anomaly, Transaction } from "./types";

const CATEGORIES = [
  "Food", "Shopping", "Travel", "Utilities", "Entertainment",
  "Health", "Groceries", "Subscriptions", "Investments", "Income", "Transfer",
];

const MERCHANTS: Record<string, string[]> = {
  Food: ["Swiggy", "Zomato", "Domino's", "Blue Tokai", "Tea Stall"],
  Shopping: ["Amazon", "Myntra", "Zara", "IKEA"],
  Travel: ["Uber", "Ola", "IndiGo", "IRCTC"],
  Utilities: ["Airtel", "Jio", "BESCOM", "Water Board"],
  Entertainment: ["Netflix", "Spotify", "PVR", "BookMyShow"],
  Health: ["Apollo Pharmacy", "1mg", "Cult.fit"],
  Groceries: ["BigBasket", "Zepto", "Blinkit"],
  Subscriptions: ["Notion", "iCloud", "ChatGPT Plus", "Adobe CC"],
  Investments: ["Zerodha", "Groww", "INDmoney"],
  Income: ["Acme Corp Salary", "Freelance Client"],
  Transfer: ["Self Transfer", "Friend"],
};

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateSampleTransactions(count = 140): Transaction[] {
  const r = rand(7);
  const now = new Date();
  const txs: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(r() * 90);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const category = CATEGORIES[Math.floor(r() * (CATEGORIES.length - 2))];
    const m = MERCHANTS[category] ?? ["Misc"];
    const merchant = m[Math.floor(r() * m.length)];
    const isIncome = category === "Income";
    const base = isIncome ? 40000 + r() * 20000 : 80 + r() * 3500;
    const amount = isIncome ? Math.round(base) : -Math.round(base);
    txs.push({
      id: `tx_${i}_${Math.floor(r() * 1e6)}`,
      date: d.toISOString(),
      merchant,
      category,
      amount,
      paymentMethod: (["UPI", "Card", "Bank", "UPI"] as const)[Math.floor(r() * 4)],
      status: r() > 0.05 ? "Completed" : r() > 0.5 ? "Pending" : "Failed",
      aiConfidence: 0.72 + r() * 0.27,
      recurring: category === "Subscriptions" || (category === "Utilities" && r() > 0.4),
      riskScore: Math.round(r() * 30),
    });
  }
  for (let m = 0; m < 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    txs.push({
      id: `salary_${m}`,
      date: d.toISOString(),
      merchant: "Acme Corp Salary",
      category: "Income",
      amount: 82000,
      paymentMethod: "Bank",
      status: "Completed",
      aiConfidence: 0.99,
      recurring: true,
      riskScore: 0,
    });
  }
  return txs.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const sampleAnomalies: Anomaly[] = [
  { id: "a1", merchant: "Tea Stall", expected: 120, actual: 450, deviation: 275, confidence: 97, risk: "High", reason: "Amount is 3.75× your average tea spend.", date: new Date().toISOString() },
  { id: "a2", merchant: "Amazon", expected: 1800, actual: 6200, deviation: 244, confidence: 92, risk: "High", reason: "Unusual purchase size vs your Amazon history.", date: new Date(Date.now() - 86400000).toISOString() },
  { id: "a3", merchant: "Uber", expected: 220, actual: 480, deviation: 118, confidence: 84, risk: "Medium", reason: "Late night ride, higher than typical.", date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "a4", merchant: "Netflix", expected: 649, actual: 799, deviation: 23, confidence: 71, risk: "Low", reason: "Plan upgrade detected.", date: new Date(Date.now() - 6 * 86400000).toISOString() },
];

export const sampleAlerts: Alert[] = [
  { id: "al1", title: "Unusual Spending Alert", message: "Tea Stall charge is 275% above typical.", risk: "High", status: "Pending", date: new Date().toISOString(), merchant: "Tea Stall", expected: 120, actual: 450 },
  { id: "al2", title: "Large Amazon Purchase", message: "Charge of ₹6,200 is well above your usual Amazon spend.", risk: "High", status: "Pending", date: new Date(Date.now() - 86400000).toISOString(), merchant: "Amazon", expected: 1800, actual: 6200 },
  { id: "al3", title: "Subscription Renewed", message: "Netflix renewed at a higher plan (₹799).", risk: "Low", status: "Resolved", date: new Date(Date.now() - 6 * 86400000).toISOString(), merchant: "Netflix" },
  { id: "al4", title: "Late Night Ride", message: "Uber ride at 2:14 AM flagged.", risk: "Medium", status: "Resolved", date: new Date(Date.now() - 3 * 86400000).toISOString(), merchant: "Uber" },
];