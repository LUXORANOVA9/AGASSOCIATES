
export enum UserRole {
  PRINCIPAL = 'PRINCIPAL',
  ADVOCATE = 'ADVOCATE',
  EXECUTIVE = 'EXECUTIVE',
  CLERK = 'CLERK',
  BANK_VIEWER = 'BANK_VIEWER',
}

export enum CaseType {
  TITLE_SEARCH = 'TITLE_SEARCH',
  LEGAL_VETTING = 'LEGAL_VETTING',
  CTC = 'CTC',
  PROPERTY_REGISTRATION = 'PROPERTY_REGISTRATION',
  MORTGAGE_REGISTRATION = 'MORTGAGE_REGISTRATION',
  INTIMATION_MORTGAGE = 'INTIMATION_MORTGAGE',
  FRANKING = 'FRANKING',
  BALANCE_TRANSFER = 'BALANCE_TRANSFER',
  PUBLIC_NOTICE = 'PUBLIC_NOTICE',
  POWER_OF_ATTORNEY = 'POWER_OF_ATTORNEY',
  LEAVE_AND_LICENSE = 'LEAVE_AND_LICENSE',
  GIFT_DEED = 'GIFT_DEED',
  MARKET_VALUATION = 'MARKET_VALUATION',
}

export enum CaseStatus {
  RECEIVED = 'RECEIVED',
  ASSIGNED = 'ASSIGNED',
  DOCUMENT_COLLECTION = 'DOCUMENT_COLLECTION',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REGISTRATION = 'PENDING_REGISTRATION',
  REGISTERED = 'REGISTERED',
  QUALITY_CHECK = 'QUALITY_CHECK',
  DELIVERED = 'DELIVERED',
  INVOICED = 'INVOICED',
  CLOSED = 'CLOSED',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
}

export enum DisbursementType {
  STAMP_DUTY = 'STAMP_DUTY',
  REGISTRATION_FEE = 'REGISTRATION_FEE',
  FRANKING_CHARGE = 'FRANKING_CHARGE',
  CTC_FEE = 'CTC_FEE',
  CHALLAN_0_3_PCT = 'CHALLAN_0_3_PCT',
  MTR_FEE = 'MTR_FEE',
  ESBTR_FEE = 'ESBTR_FEE',
  NEWSPAPER_CHARGE = 'NEWSPAPER_CHARGE',
  OTHER = 'OTHER',
}

export interface Bank {
  id: string;
  name: string;
  short_code: string;
  type: 'BANK' | 'NBFC';
  billing_contact?: string;
  advance_balance: number;
  created_at: Date;
}

export interface Case {
  id: string;
  case_number: string;
  org_id: string;
  bank_id: string;
  case_type: CaseType;
  status: CaseStatus;
  borrower_name: string;
  loan_amount: number;
  received_date: Date;
  sla_deadline: Date;
  assigned_executive_id?: string;
  disbursement_total: number;
  professional_fee: number;
  created_at: Date;
  updated_at: Date;
}

export interface Disbursement {
  id: string;
  case_id: string;
  type: DisbursementType;
  amount: number;
  paid_date: Date;
  is_reimbursed: boolean;
}
