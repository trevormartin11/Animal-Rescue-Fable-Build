export type CaseStatus =
  | "new"
  | "accepted"
  | "owner_contacted"
  | "vet_account_set"
  | "paid"
  | "closed"
  | "denied";

export const ACTIVE_STATUSES: CaseStatus[] = [
  "new",
  "accepted",
  "owner_contacted",
  "vet_account_set",
  "paid",
];

export const STATUS_LABELS: Record<CaseStatus, string> = {
  new: "New",
  accepted: "Accepted",
  owner_contacted: "Owner contacted",
  vet_account_set: "On vet account",
  paid: "Paid",
  closed: "Closed",
  denied: "Denied",
};

/** The forward path a case moves through (denied is an exit from any point). */
export const STATUS_FLOW: CaseStatus[] = [
  "new",
  "accepted",
  "owner_contacted",
  "vet_account_set",
  "paid",
  "closed",
];

/** What Chelsea still needs to do for a case in this status. */
export const NEXT_ACTION: Record<CaseStatus, string | null> = {
  new: "Review the Gmail draft and send it to the owner",
  accepted: "Intro email going out — waiting to hear back",
  owner_contacted: "Waiting for the owner to add Chelsea to the vet account",
  vet_account_set: "Call the vet (or use their portal) to pay",
  paid: "Confirm the receipt is filed, then close the case",
  closed: null,
  denied: null,
};

export interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  owner_id: string | null;
  animal_name: string | null;
  species: string | null;
  breed: string | null;
  situation: string | null;
  amount: number | null;
  vet_name: string | null;
  vet_phone: string | null;
  status: CaseStatus;
  denial_reason: string | null;
  source: "email" | "manual";
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  draft_gmail_id: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  requested_at: string;
  accepted_at: string | null;
  owner_contacted_at: string | null;
  vet_account_set_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  denied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseWithOwner extends Case {
  owners: Owner | null;
}

export interface Receipt {
  id: string;
  case_id: string | null;
  source: "email" | "upload";
  amount: number | null;
  storage_path: string | null;
  filename: string | null;
  content_type: string | null;
  gmail_message_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  forwarded_to_dext_at: string | null;
  forward_error: string | null;
  received_at: string;
  created_at: string;
}

export interface CasePhoto {
  id: string;
  case_id: string;
  storage_path: string;
  filename: string | null;
  content_type: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number;
  pacc_sender_emails: string[];
  barry_bcc_email: string | null;
  dext_email: string | null;
  family_recipient_emails: string[];
  monthly_recap_enabled: boolean;
  reply_signature: string | null;
  gmail_connected_email: string | null;
  last_synced_at: string | null;
  updated_at: string;
}

export interface ActivityEntry {
  id: number;
  case_id: string | null;
  event: string;
  detail: string | null;
  created_at: string;
}

export interface Recap {
  id: string;
  period_month: string;
  narrative: string | null;
  stats: RecapStats | null;
  sent_at: string | null;
  sent_to: string[] | null;
  created_at: string;
}

export interface RecapStats {
  month: string; // e.g. "2026-06"
  casesHelped: number;
  totalGiven: number;
  yearTotal: number;
  yearCases: number;
  animals: { name: string | null; species: string | null; situation: string | null; amount: number | null }[];
}
