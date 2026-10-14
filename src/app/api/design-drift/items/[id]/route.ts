import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedStatuses = [
  "NEW",
  "RAISED",
  "IN_PROGRESS",
  "FIXED",
  "ACCEPTED",
] as const;

const allowedSeverities = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const id = params.id;

    const existing = await prisma.designDriftItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Drift item not found." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (body.area !== undefined) {
      data.area = String(body.area).trim();
    }

    if (body.title !== undefined) {
      data.title = String(body.title).trim();
    }

    if (body.approvedReference !== undefined) {
      data.approvedReference =
        body.approvedReference?.trim() || null;
    }

    if (body.liveObservation !== undefined) {
      data.liveObservation =
        String(body.liveObservation).trim();
    }

    if (body.approvedScreenshot !== undefined) {
      data.approvedScreenshot =
        body.approvedScreenshot?.trim() || null;
    }

    if (body.liveScreenshot !== undefined) {
      data.liveScreenshot =
        body.liveScreenshot?.trim() || null;
    }

    if (body.designReference !== undefined) {
      data.designReference =
        body.designReference?.trim() || null;
    }

    if (body.raisedTo !== undefined) {
      data.raisedTo =
        body.raisedTo?.trim() || null;
    }

    if (
      body.severity !== undefined &&
      allowedSeverities.includes(body.severity)
    ) {
      data.severity = body.severity;
    }

    if (
      body.status !== undefined &&
      allowedStatuses.includes(body.status)
    ) {
      data.status = body.status;
    }

    if (body.dateRaised !== undefined) {
      data.dateRaised = body.dateRaised
        ? new Date(body.dateRaised)
        : null;
    }

    if (body.fixNotes !== undefined) {
      data.fixNotes =
        body.fixNotes?.trim() || null;
    }

    if (body.dateFixed !== undefined) {
      data.dateFixed = body.dateFixed
        ? new Date(body.dateFixed)
        : null;
    }

    const updated =
      await prisma.designDriftItem.update({
        where: { id },
        data,
      });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "PATCH /api/design-drift/items/[id] failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update drift item." },
      { status: 500 }
    );
  }
}