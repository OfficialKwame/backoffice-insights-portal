import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      title,
      content,
      category,
      isPinned,
      width,
      height,
    } = body;

    const note = await prisma.quickNote.update({
      where: {
        id: params.id,
      },
      data: {
        ...(title !== undefined && {
          title: title.trim(),
        }),
        ...(content !== undefined && {
          content: content.trim(),
        }),
        ...(category !== undefined && {
          category: category?.trim() || null,
        }),
        ...(isPinned !== undefined && {
          isPinned,
        }),
        ...(width !== undefined && {
          width,
        }),
        ...(height !== undefined && {
          height,
        }),
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("Failed to update quick note:", error);

    return NextResponse.json(
      { error: "Failed to update quick note." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.quickNote.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete quick note:", error);

    return NextResponse.json(
      { error: "Failed to delete quick note." },
      { status: 500 }
    );
  }
}