/*
  USSD (PosUssd) event definitions.

  Every USSD log carries a TraceId that is shared by all
  steps of one USSD session, including the payment
  callback. Sessions are rebuilt from TraceId.
*/

export const USSD_EVENTS = {
  DIAL: "DialCode",
  AMOUNT_ENTERED: "Input: EnterPaymentAmount",
  AMOUNT_PROCESSED: "Option: ProcessAmountEntered",
  CUSTOMER_NUMBER: "Option: EnterCustomerMobileNumber",
  PAYMENT_REQUESTED: "Screen: PaymentRequested",
  COMPLETED: "Callback: PaymentCompleted",
  FAILED: "Callback: PaymentUnsuccessful",
} as const;

export const USSD_EVENT_LABELS: Record<string, string> = {
  [USSD_EVENTS.DIAL]: "Dialled code",
  [USSD_EVENTS.AMOUNT_ENTERED]: "Entered amount",
  [USSD_EVENTS.AMOUNT_PROCESSED]: "Amount processed",
  [USSD_EVENTS.CUSTOMER_NUMBER]: "Entered customer number",
  [USSD_EVENTS.PAYMENT_REQUESTED]: "Payment requested",
  [USSD_EVENTS.COMPLETED]: "Payment completed",
  [USSD_EVENTS.FAILED]: "Payment unsuccessful",
};

export type UssdFlowDefinition = {
  key: string;
  label: string;
  description: string;
  steps: string[];
};

/*
  Steps are listed in the order a customer moves through
  them. The final step is always a completed payment.
  Confirmed against Datadog: each step only ever appears
  in the flows listed here.
*/
export const USSD_FLOWS: UssdFlowDefinition[] = [
  {
    key: "tipFlow",
    label: "Tip Flow",
    description: "Standard payment: amount, confirm, pay.",
    steps: [
      USSD_EVENTS.DIAL,
      USSD_EVENTS.AMOUNT_ENTERED,
      USSD_EVENTS.AMOUNT_PROCESSED,
      USSD_EVENTS.PAYMENT_REQUESTED,
      USSD_EVENTS.COMPLETED,
    ],
  },
  {
    key: "paymentCategory",
    label: "Payment Category",
    description:
      "Payment against a category (e.g. loan repayment).",
    steps: [
      USSD_EVENTS.DIAL,
      USSD_EVENTS.AMOUNT_ENTERED,
      USSD_EVENTS.PAYMENT_REQUESTED,
      USSD_EVENTS.COMPLETED,
    ],
  },
  {
    key: "employeeFlow",
    label: "Employee Flow",
    description:
      "Staff enter the customer's number to request payment.",
    steps: [
      USSD_EVENTS.DIAL,
      USSD_EVENTS.CUSTOMER_NUMBER,
      USSD_EVENTS.PAYMENT_REQUESTED,
      USSD_EVENTS.COMPLETED,
    ],
  },
];

/*
  Datadog reports the same network under different
  channel names (e.g. vodafone-gh and vodafone-gh-ussd).
  Group them under current network names.
*/
export function normaliseNetwork(
  channel: string | null | undefined
) {
  if (!channel) {
    return null;
  }

  const value = channel.toLowerCase();

  if (value.includes("mtn")) {
    return "MTN";
  }

  if (
    value.includes("vodafone") ||
    value.includes("telecel")
  ) {
    return "Telecel";
  }

  if (
    value.includes("tigo") ||
    value.includes("airtel")
  ) {
    return "AT";
  }

  return channel;
}
