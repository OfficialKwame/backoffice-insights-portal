export const BACKOFFICE_APP_EVENT_LABELS: Record<
  string,
  string
> = {
  "Start Session": "Open App",
  "Take Payment": "Select Payment Channel",
  "Add To Cart": "Enter Customer Number",
  "Begin Purchase": "Enter Payment Amount",
  "Purchase": "Successful Transaction",
  "View Item": "Screen View",
  "Withdraw Balance": "Withdraw Balance",
  "Otp Request": "OTP Request",
  "Login": "Login",
  "App Crash": "App Crash",
};

export const PAYMENT_JOURNEY_EVENTS = [
  {
    eventName: "Start Session",
    label: "Open App",
    step: 1,
  },
  {
    eventName: "Take Payment",
    label: "Select Payment Channel",
    step: 2,
  },
  {
    eventName: "Add To Cart",
    label: "Enter Customer Number",
    step: 3,
  },
  {
    eventName: "Begin Purchase",
    label: "Enter Payment Amount",
    step: 4,
  },
  {
    eventName: "Purchase",
    label: "Successful Transaction",
    step: 5,
  },
];