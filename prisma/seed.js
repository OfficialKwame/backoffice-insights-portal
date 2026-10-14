const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const tests = [
  // =====================================================
  // BACKOFFICE LITE — 21 CHECKS
  // =====================================================

  [
    "LITE",
    "Open & Sign in",
    "Confirm the merchant can access BackOffice Lite."
  ],
  [
    "LITE",
    "Homepage",
    "Confirm the Lite homepage loads correctly."
  ],
  [
    "LITE",
    "MTN MoMo",
    "Complete a successful MTN MoMo collection."
  ],
  [
    "LITE",
    "Telecel Cash",
    "Complete a successful Telecel Cash collection."
  ],
  [
    "LITE",
    "AT Money",
    "Complete a successful AT Money collection."
  ],
  [
    "LITE",
    "Bank Card",
    "Complete a successful Bank Card collection using Android Tap to Pay."
  ],
  [
    "LITE",
    "GhQR",
    "Complete a successful GhQR collection."
  ],
  [
    "LITE",
    "Pay Small Small",
    "Complete a successful Pay Small Small transaction."
  ],
  [
    "LITE",
    "Send Invoice",
    "Create and send an invoice successfully."
  ],
  [
    "LITE",
    "Payments",
    "Confirm completed collections appear correctly in Payments."
  ],
  [
    "LITE",
    "Invoices",
    "Confirm invoices and their statuses display correctly."
  ],
  [
    "LITE",
    "Money / Balance",
    "Confirm the merchant balance and Money area load correctly."
  ],
  [
    "LITE",
    "Transfer to Account",
    "Complete the Transfer to Account flow."
  ],
  [
    "LITE",
    "Sweep to Account",
    "Complete the Sweep to Account flow."
  ],
  [
    "LITE",
    "Transfer to Hubtel Business",
    "Complete a transfer to another Hubtel business."
  ],
  [
    "LITE",
    "Withdraw",
    "Complete a successful withdrawal to the selected settlement account."
  ],
  [
    "LITE",
    "Airtime",
    "Complete the Airtime purchase flow."
  ],
  [
    "LITE",
    "Internet Bundle",
    "Complete the Internet Bundle purchase flow."
  ],
  [
    "LITE",
    "ECG",
    "Complete the ECG payment flow."
  ],
  [
    "LITE",
    "Ghana Water",
    "Complete the Ghana Water payment flow."
  ],
  [
    "LITE",
    "DStv / GoTV",
    "Complete the DStv or GoTV payment flow."
  ],

  // =====================================================
  // BACKOFFICE APP — 18 CHECKS
  // =====================================================

  [
    "APP",
    "Open & Sign in",
    "Confirm merchant or staff can access the BackOffice App."
  ],
  [
    "APP",
    "Collect Money Page",
    "Confirm the Collect Money page and collection options load correctly."
  ],
  [
    "APP",
    "MTN MoMo",
    "Complete a successful MTN MoMo collection."
  ],
  [
    "APP",
    "Telecel Cash",
    "Complete a successful Telecel Cash collection."
  ],
  [
    "APP",
    "AT Money",
    "Complete a successful AT Money collection."
  ],
  [
    "APP",
    "Bank Card",
    "Complete a successful Bank Card collection."
  ],
  [
    "APP",
    "Android Tap to Pay",
    "Complete a successful Android contactless Tap to Pay collection."
  ],
  [
    "APP",
    "GhQR",
    "Complete a successful GhQR collection."
  ],
  [
    "APP",
    "Pay Small Small",
    "Complete a successful Pay Small Small transaction."
  ],
  [
    "APP",
    "Simple Invoice",
    "Create and send a one-off Simple Invoice."
  ],
  [
    "APP",
    "Repeat Invoice",
    "Create and send a Repeat Invoice."
  ],
  [
    "APP",
    "Invoice Tracking",
    "Confirm the created invoice appears with the correct status and details."
  ],
  [
    "APP",
    "Payments",
    "Confirm a completed collection appears in Payments."
  ],
  [
    "APP",
    "Payment Details",
    "Open a payment and confirm the transaction details are correct."
  ],
  [
    "APP",
    "Receipt",
    "Confirm a payment receipt can be viewed or sent."
  ],
  [
    "APP",
    "Payment Search / Date Filter",
    "Search and filter payment records successfully."
  ],
  [
    "APP",
    "In-store QR",
    "Display the business QR and complete the in-store QR payment flow."
  ],
  [
    "APP",
    "In-store USSD",
    "Display the business USSD code and complete the in-store USSD payment flow."
  ],

  // =====================================================
  // BACKOFFICE PORTAL — 10 CHECKS
  // =====================================================

  [
    "PORTAL",
    "Payments / Take Payment",
    "Open Payments and confirm the Take Payment options load correctly."
  ],
  [
    "PORTAL",
    "MTN MoMo",
    "Complete the MTN MoMo Take Payment flow successfully."
  ],
  [
    "PORTAL",
    "MTN MoMo — QR",
    "Generate the MTN MoMo QR alternative and complete payment by scanning."
  ],
  [
    "PORTAL",
    "Telecel Cash",
    "Complete the Telecel Cash Take Payment flow successfully."
  ],
  [
    "PORTAL",
    "Telecel Cash — QR",
    "Generate the Telecel Cash QR alternative and complete payment by scanning."
  ],
  [
    "PORTAL",
    "AT Money",
    "Complete the AT Money Take Payment flow successfully."
  ],
  [
    "PORTAL",
    "AT Money — QR",
    "Generate the AT Money QR alternative and complete payment by scanning."
  ],
  [
    "PORTAL",
    "GhQR",
    "Complete the GhQR Take Payment flow successfully."
  ],
  [
    "PORTAL",
    "Pay Small Small",
    "Complete the Pay Small Small flow through customer verification, code confirmation, and status resolution."
  ],
  [
    "PORTAL",
    "Payment Record",
    "Confirm the completed or resolved payment can be viewed from Payments."
  ]
];

async function main() {
  const existing = await prisma.testDefinition.count();

  // Prevent accidentally creating duplicate test definitions.
  if (existing > 0) {
    console.log(
      `TestDefinition already contains ${existing} record(s).`
    );
    console.log("Seed stopped to avoid duplicates.");
    return;
  }

  const surfaceOrder = {
    LITE: 0,
    APP: 0,
    PORTAL: 0
  };

  for (const [surface, name, description] of tests) {
    surfaceOrder[surface] += 1;

    await prisma.testDefinition.create({
      data: {
        surface,
        name,
        description,
        expectedResult: description,
        sortOrder: surfaceOrder[surface],
        isActive: true
      }
    });
  }

  const liteCount = await prisma.testDefinition.count({
    where: { surface: "LITE" }
  });

  const appCount = await prisma.testDefinition.count({
    where: { surface: "APP" }
  });

  const portalCount = await prisma.testDefinition.count({
    where: { surface: "PORTAL" }
  });

  const totalCount = await prisma.testDefinition.count();

  console.log("");
  console.log("Surface Testing library created successfully.");
  console.log("---------------------------------------------");
  console.log(`Lite:              ${liteCount}`);
  console.log(`BackOffice App:    ${appCount}`);
  console.log(`BackOffice Portal: ${portalCount}`);
  console.log("---------------------------------------------");
  console.log(`Total:             ${totalCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });