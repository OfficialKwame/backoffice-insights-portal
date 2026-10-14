import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DesignDriftSurface = "LITE" | "APP";

export async function GET() {
  try {
    const reviews = await prisma.designDriftReview.findMany({
      include: {
        items: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        reviewDate: "desc",
      },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error(
      "GET /api/design-drift/reviews failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load design drift reviews." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      surface,
      reviewDate,
      areasReviewed,
      notes,
    } = body;

    if (!surface || !reviewDate) {
      return NextResponse.json(
        {
          error: "Surface and review date are required.",
        },
        { status: 400 }
      );
    }

    const allowedSurfaces: DesignDriftSurface[] = [
      "LITE",
      "APP",
    ];

    if (
      !allowedSurfaces.includes(
        surface as DesignDriftSurface
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid design drift surface.",
        },
        { status: 400 }
      );
    }

    const review = await prisma.designDriftReview.create({
      data: {
        surface,
        reviewDate: new Date(reviewDate),
        areasReviewed: Math.max(
          0,
          Number(areasReviewed) || 0
        ),
        notes: notes?.trim() || null,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(review, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "POST /api/design-drift/reviews failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to create design drift review." },
      { status: 500 }
    );
  }
}