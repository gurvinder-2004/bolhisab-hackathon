// Check current GST rates and rules on https://cbic-gst.gov.in before every demo.
export const GST_RATES = [0, 3, 5, 18, 40]; // percent; main rates are 0, 5, 18 (plus 3 and 40)
export const EINVOICE_THRESHOLD_PAISE = 5_000_000_000; // Rs 5 crore; e-invoicing (IRN) only ABOVE this
export const INVOICE_PREFIX = 'INV';
export const REMINDER_DEADLINE_DAYS = 7; // demand letter deadline, used from M4
export const DUE_SOON_DAYS = 7; // invoice shows "due soon" this many days before the due date
