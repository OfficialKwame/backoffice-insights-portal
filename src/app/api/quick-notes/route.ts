import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const notes = await prisma.quickNote.findMany({
      orderBy: [
        {
          isPinned: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Failed to load quick notes:", error);

    return NextResponse.json(
      { error: "Failed to load quick notes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { title, content, category } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    const note = await prisma.quickNote.create({
      data: {
        title: title.trim(),
        content: content?.trim() || "",
        category: category?.trim() || null,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Failed to create quick note:", error);

    return NextResponse.json(
      { error: "Failed to create quick note." },
      { status: 500 }
    );
  }
}