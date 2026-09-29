import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions, replaceTransactions, appendTransactions } from "./transactions.functions";
import { computeAnalytics, EMPTY_ANALYTICS, type Analytics } from "./analytics";
import type { Transaction } from "./types";

const TX_KEY = ["transactions"] as const;

export function useTransactions(): Transaction[] {
  const fetch = useServerFn(listTransactions);
  const { data } = useQuery({
    queryKey: TX_KEY,
    queryFn: () => fetch(),
    staleTime: 60_000,
    refetchInterval: 15_000, // Poll every 15s for live synced transactions
  });
  return data ?? [];
}

export function useTransactionsQuery() {
  const fetch = useServerFn(listTransactions);
  return useQuery({ queryKey: TX_KEY, queryFn: () => fetch(), staleTime: 60_000 });
}

export function useAnalytics(): Analytics {
  const txs = useTransactions();
  return useMemo(() => (txs.length ? computeAnalytics(txs) : EMPTY_ANALYTICS), [txs]);
}

export function useReplaceTransactions() {
  const qc = useQueryClient();
  const save = useServerFn(replaceTransactions);
  return useMutation({
    mutationFn: (transactions: Transaction[]) =>
      save({
        data: {
          transactions: transactions.map((t) => ({
            date: t.date,
            merchant: t.merchant,
            category: t.category,
            amount: t.amount,
            paymentMethod: t.paymentMethod,
            status: t.status,
            aiConfidence: t.aiConfidence,
            recurring: t.recurring,
            riskScore: t.riskScore,
          })),
        },
      }),
    onSuccess: () => {
      // Full reset: transactions replaced → alerts/notifications/insights derived from them are stale.
      qc.invalidateQueries({ queryKey: TX_KEY });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useAppendTransactions() {
  const qc = useQueryClient();
  const save = useServerFn(appendTransactions);
  return useMutation({
    mutationFn: (transactions: Transaction[]) =>
      save({
        data: {
          transactions: transactions.map((t) => ({
            date: t.date,
            merchant: t.merchant,
            category: t.category,
            amount: t.amount,
            paymentMethod: t.paymentMethod,
            status: t.status,
            aiConfidence: t.aiConfidence,
            recurring: t.recurring,
            riskScore: t.riskScore,
          })),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TX_KEY }),
  });
}



export function parseCsv(text: string): Transaction[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  
  // Find header row - usually the first non-empty line with enough commas
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].split(",").length >= 3) {
      headerRowIdx = i;
      break;
    }
  }
  
  const header = lines[headerRowIdx].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const idx = (k: string) => header.findIndex((h) => h.includes(k));
  
  const iDate = Math.max(idx("date"), idx("time"), idx("txn date"), idx("value date"));
  const iMerchant = Math.max(idx("merchant"), idx("desc"), idx("name"), idx("payee"), idx("particulars"), idx("narration"));
  const iCategory = idx("category") >= 0 ? idx("category") : idx("type");
  const iMethod = Math.max(idx("method"), idx("payment"), idx("mode"));
  
  // Amount can be single column or split into Debit/Credit or Withdrawal/Deposit
  const iAmount = Math.max(idx("amount"), idx("value"));
  const iDebit = Math.max(idx("debit"), idx("withdrawal"), idx("dr"));
  const iCredit = Math.max(idx("credit"), idx("deposit"), idx("cr"));

  const INCOME_CATS = new Set(["salary", "income", "refund", "bonus", "interest", "credit", "investment", "deposit"]);
  const RECURRING_MERCHANTS = /netflix|spotify|prime|hotstar|youtube|fitness|gym|fibernet|act|airtel|jio|rent|insurance|aws|azure|google cloud|apple|adobe|canva/i;
  
  // Auto-categorization map for "perfect" dataset integration
  const CATEGORY_MAP: Record<string, RegExp> = {
    "Food & Dining": /swiggy|zomato|kfc|mcdonalds|dominos|starbucks|cafe|restaurant|baker|eats/i,
    "Shopping": /amazon|flipkart|myntra|ajio|zara|h&m|reliance|croma|d-mart|dmart/i,
    "Transport": /uber|ola|rapido|irctc|makemytrip|goibibo|flight|indigo|petrol|fuel|shell|hpcl|bpcl/i,
    "Utilities": /electricity|bescom|water|gas|broadband|act fibernet|airtel|jio|recharge|bill/i,
    "Entertainment": /bookmyshow|pvr|inox|netflix|spotify|prime|hotstar|youtube/i,
    "Health & Wellness": /pharmacy|apollo|netmeds|practo|hospital|clinic|gym|curefit|cult/i,
    "Housing": /rent|maintenance|society|brokerage/i,
    "Income": /salary|payroll|refund|dividend|interest|zerodha|groww/i,
  };

  const parseDate = (raw: string): string => {
    const s = (raw ?? "").trim().replace(/['"]/g, '');
    if (!s) return new Date().toISOString();
    
    // Handle DD-MM-YYYY or DD/MM/YYYY common in India/UK
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const yy = y.length === 2 ? `20${y}` : y;
      return new Date(`${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`).toISOString();
    }
    const t = new Date(s);
    return isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
  };

  const out: Transaction[] = [];
  const seen = new Set<string>();
  
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    // Basic CSV splitting that respects quotes
    const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
    const cleanCol = (idx: number) => (cols[idx] ?? "").replace(/^"|"$/g, "").trim();
    
    if (cols.length < 3) continue;

    let rawAmt = 0;
    if (iAmount >= 0) {
      rawAmt = parseFloat(cleanCol(iAmount).replace(/,/g, "") || "0");
    } else if (iDebit >= 0 || iCredit >= 0) {
      const debit = parseFloat(cleanCol(iDebit).replace(/,/g, "") || "0");
      const credit = parseFloat(cleanCol(iCredit).replace(/,/g, "") || "0");
      rawAmt = credit > 0 ? credit : -debit;
    }

    let category = (iCategory >= 0 ? cleanCol(iCategory) : "Uncategorized") || "Uncategorized";
    const merchant = (iMerchant >= 0 ? cleanCol(iMerchant) : "Unknown") || "Unknown";
    
    // AI-like Auto-Categorization if missing or generic
    if (category === "Uncategorized" || category === "Unknown") {
      for (const [catName, regex] of Object.entries(CATEGORY_MAP)) {
        if (regex.test(merchant)) {
          category = catName;
          break;
        }
      }
    }

    const isIncome =
      INCOME_CATS.has(category.toLowerCase()) ||
      (rawAmt > 0) || // If explicitly positive from Credit column
      (rawAmt >= 0 && /payroll|salary|refund|interest|credit/i.test(merchant));
      
    const signed = isNaN(rawAmt) ? 0 : isIncome ? Math.abs(rawAmt) : -Math.abs(rawAmt);
    if (!signed) continue; // Skip 0 value transactions

    const date = parseDate(iDate >= 0 ? cleanCol(iDate) : "");
    const methodRaw = (iMethod >= 0 ? cleanCol(iMethod) : "").toUpperCase();
    let method: Transaction["paymentMethod"] = "UPI";
    if (/CARD|DEBIT|CREDIT|VISA|MASTERCARD/i.test(methodRaw) || /card/i.test(merchant)) method = "Card";
    if (/BANK|NEFT|RTGS|IMPS|TRANSFER/i.test(methodRaw) || /neft|rtgs|imps/i.test(merchant)) method = "Bank";
    if (/CASH/i.test(methodRaw)) method = "Cash";

    const dedupe = `${date.split('T')[0]}|${merchant.substring(0, 10)}|${signed}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    out.push({
      id: `csv_${i}_${Date.now()}`,
      date,
      merchant,
      category,
      amount: signed,
      paymentMethod: method,
      status: "Completed",
      aiConfidence: category !== "Uncategorized" ? 0.95 : 0.6,
      recurring: RECURRING_MERCHANTS.test(merchant),
      riskScore: Math.abs(signed) > 10000 ? 45 : Math.abs(signed) > 50000 ? 80 : 10,
    });
  }
  return out;
}

export function smsToCsv(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = ["transaction_id,date,merchant_name,amount,category"];
  let id = 1;
  for (const line of lines) {
    // Advanced Regex for various Indian Bank SMS formats
    const amtMatch = line.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i);
    const dateMatch = line.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+[a-zA-Z]{3}\s+\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+)/);
    
    // Better merchant extraction heuristics
    let merchMatch = line.match(/(?:at|to|from)\s+([A-Za-z][A-Za-z0-9 &.'-]+?)(?:\s+on\b|\s*[-–]|\s*$|\s+via\b|\s+ref\b)/i);
    if (!merchMatch) {
       // Fallback for VPA/UPI formats (e.g., sent to username@bank)
       merchMatch = line.match(/(?:UPI|VPA)[\s/:-]+([A-Za-z0-9.-]+@[A-Za-z]+)/i);
    }
    
    let cat = "Uncategorized";
    if (/(?:credited|salary|refund)/i.test(line)) cat = "Income";
    else if (/(?:debited|spent|paid)/i.test(line)) {
      const explicitCat = line.match(/[-–]\s*([A-Za-z ]+?)\s*$/) ??
                          line.match(/\b(Food|Snacks|Rent|Shopping|Groceries|Transport|Fuel|Entertainment|Medical|Utilities|Salary|Gym|Laundry|Parking)\b/i);
      if (explicitCat) cat = explicitCat[1].trim();
    }

    if (!amtMatch) continue;
    const value = parseFloat(amtMatch[1].replace(/,/g, ""));
    const dateStr = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('en-GB');
    const merchant = (merchMatch?.[1] ?? "Unknown").trim().replace(/['"]/g, '');
    
    rows.push([id++, dateStr, `"${merchant}"`, value, `"${cat}"`].join(","));
  }
  return rows.length > 1 ? rows.join("\n") : "";
}
