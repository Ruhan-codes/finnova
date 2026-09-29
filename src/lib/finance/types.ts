export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  paymentMethod: "UPI" | "Card" | "Bank" | "Cash";
  status: "Completed" | "Pending" | "Failed";
  aiConfidence: number;
  recurring: boolean;
  riskScore: number;
  notes?: string;
  reviewStatus?: "verified" | "suspicious" | "under_review" | "resolved" | "disputed";
};

export type Anomaly = {
  id: string;
  merchant: string;
  expected: number;
  actual: number;
  deviation: number;
  confidence: number;
  risk: "Low" | "Medium" | "High";
  reason: string;
  date: string;
};

export type Alert = {
  id: string;
  title: string;
  message: string;
  risk: "Low" | "Medium" | "High";
  status: "Pending" | "Resolved";
  date: string;
  merchant?: string;
  expected?: number;
  actual?: number;
};