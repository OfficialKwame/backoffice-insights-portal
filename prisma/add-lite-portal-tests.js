const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const tests = [
  [
    "Access",
    "Confirm the BackOffice Lite Portal loads and the user can access it."
  ],
  [
    "Dashboard",
    "Confirm the Dashboard opens successfully."
  ],
  [
    "Business Requests",
    "Confirm the Business Requests page loads and displays requests."
  ],
  [
    "Business Requests Search",
    "Confirm search works on the Business Requests page."
  ],
  [
    "Business Requests Filter",
    "Confirm filter functionality works on the Business Requests page."
  ],
  [
    "Approve Business Request",
    "Complete the business-request approval flow successfully."
  ],
  [
    "Reject Business Request",
    "Complete the business-request rejection flow successfully."
  ],
  [
    "Business Accounts",
    "Confirm the Business Accounts page loads and displays businesses."
  ],
  [
    "Business Accounts Search",
    "Confirm search works using business name, email, or mobile number."
  ],
  [
    "Create Business",
    "Complete the Create Business flow successfully."
  ],
  [
    "View Business",
    "Open an existing business and confirm its details can be viewed."
  ],
  [
    "Edit Business",
    "Edit an existing business and save the changes successfully."
  ],
  [
    "Suspended Accounts",
    "Confirm the Suspended Accounts page loads and displays suspended businesses."
  ],
  [
    "View Suspended Business",
    "Open a suspended business record and confirm its details can be viewed."
  ]
];

async function main() {
  const existingCount = await prisma.testDefinition.count({
    where: {
      surface: "LITE_PORTAL"
    }
  });

  if (existingCount > 0) {
    console.log(
      `LITE_PORTAL already contains ${existingCount} test definition(s).`
    );
    console.log("Stopped to avoid duplicates.");
    return;
  }

  for (let i = 0; i < tests.length; i++) {
    const [name, description] = tests[i];

    await prisma.testDefinition.create({
      data: {
        surface: "LITE_PORTAL",
        name,
        description,
        expectedResult: description,
        sortOrder: i + 1,
        isActive: true
      }
    });
  }

  const litePortalCount = await prisma.testDefinition.count({
    where: {
      surface: "LITE_PORTAL"
    }
  });

  const totalCount = await prisma.testDefinition.count();

  console.log("");
  console.log("BackOffice Lite Portal tests added successfully.");
  console.log("---------------------------------------------");
  console.log(`Lite Portal: ${litePortalCount}`);
  console.log(`Total tests: ${totalCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });