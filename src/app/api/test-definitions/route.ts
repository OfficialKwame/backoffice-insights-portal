import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tests = await prisma.testDefinition.findMany({
    orderBy: [
      { surface: "asc" },
      { sortOrder: "asc" }
    ]
  });

  return NextResponse.json(tests);
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    surface,
    name,
    description,
    steps,
    expectedResult,
  } = body;

  if (!surface || !name) {
    return NextResponse.json(
      { error: "Surface and name are required." },
      { status: 400 }
    );
  }

  const lastTest = await prisma.testDefinition.findFirst({
    where: {
      surface,
    },
    orderBy: {
      sortOrder: "desc",
    },
  });

  const nextSortOrder = lastTest
    ? lastTest.sortOrder + 1
    : 1;

  const test = await prisma.testDefinition.create({
    data: {
      surface,
      name,
      description: description || null,
      steps: steps || null,
      expectedResult: expectedResult || null,
      sortOrder: nextSortOrder,
      isActive: true,
    },
  });

  return NextResponse.json(test, { status: 201 });
}