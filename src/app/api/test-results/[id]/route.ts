import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  const { result, note, issueReference } = body;

  const allowedResults = ["PASS", "FAIL", "BLOCKED", "NOT_RUN"];

  if (result && !allowedResults.includes(result)) {
    return NextResponse.json(
      { error: "Invalid test result." },
      { status: 400 }
    );
  }

  const updated = await prisma.testResultEntry.update({
    where: {
      id: params.id,
    },
    data: {
      ...(result !== undefined && { result }),
      ...(note !== undefined && {
        note: note || null,
      }),
      ...(issueReference !== undefined && {
        issueReference: issueReference || null,
      }),
    },
  });

  return NextResponse.json(updated);
}