import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DesignDriftSeverity = "LOW" | "MEDIUM" | "HIGH";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      reviewId,
      area,
      title,
      approvedReference,
      liveObservation,
      approvedScreenshot,
      liveScreenshot,
      severity,
      designReference,
    } = body;

    if (!reviewId || !area || !title || !liveObservation) {
      return NextResponse.json(
        {
          error:
            "Review, area, title and live observation are required.",
        },
        { status: 400 }
      );
    }

    const review = await prisma.designDriftReview.findUnique({
      where: {
        id: reviewId,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Design drift review not found." },
        { status: 404 }
      );
    }

    const allowedSeverities: DesignDriftSeverity[] = [
      "LOW",
      "MEDIUM",
      "HIGH",
    ];

    const selectedSeverity =
      allowedSeverities.includes(
        severity as DesignDriftSeverity
      )
        ? (severity as DesignDriftSeverity)
        : "MEDIUM";

    const item = await prisma.designDriftItem.create({
      data: {
        reviewId,
        area: area.trim(),
        title: title.trim(),
        approvedReference:
          approvedReference?.trim() || null,
        liveObservation: liveObservation.trim(),
        approvedScreenshot:
          approvedScreenshot?.trim() || null,
        liveScreenshot:
          liveScreenshot?.trim() || null,
        severity: selectedSeverity,
        designReference:
          designReference?.trim() || null,
        status: "NEW",
      },
    });

    return NextResponse.json(item, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "POST /api/design-drift/items failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to create design drift item." },
      { status: 500 }
    );
  }
}