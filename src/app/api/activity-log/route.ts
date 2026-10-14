import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const activities = await prisma.activityLog.findMany({
      orderBy: {
        activityDate: "desc",
      },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Failed to load activities:", error);

    return NextResponse.json(
      { error: "Failed to load activities." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { category, action, description, activityDate } = body;

    if (!category || !action) {
      return NextResponse.json(
        { error: "Category and action are required." },
        { status: 400 }
      );
    }

    const activity = await prisma.activityLog.create({
      data: {
        category,
        action,
        description: description || null,
        activityDate: activityDate
          ? new Date(activityDate)
          : new Date(),
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity:", error);

    return NextResponse.json(
      { error: "Failed to create activity." },
      { status: 500 }
    );
  }
}
