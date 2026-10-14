import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    /*
     * Reorder a test within its surface.
     *
     * direction:
     * - "up"
     * - "down"
     */
    if (
      body.direction === "up" ||
      body.direction === "down"
    ) {
      const currentTest =
        await prisma.testDefinition.findUnique({
          where: {
            id: params.id,
          },
        });

      if (!currentTest) {
        return NextResponse.json(
          { error: "Test not found." },
          { status: 404 }
        );
      }

      /*
       * Always read the entire surface in its current order.
       *
       * id is used as a secondary sort so that tests with
       * duplicate sortOrder values still have a stable order.
       */
      const surfaceTests =
        await prisma.testDefinition.findMany({
          where: {
            surface: currentTest.surface,
          },
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              id: "asc",
            },
          ],
        });

      const currentIndex = surfaceTests.findIndex(
        (test) => test.id === currentTest.id
      );

      if (currentIndex === -1) {
        return NextResponse.json(
          { error: "Test not found in surface." },
          { status: 404 }
        );
      }

      const targetIndex =
        body.direction === "up"
          ? currentIndex - 1
          : currentIndex + 1;

      /*
       * Already at the top/bottom.
       */
      if (
        targetIndex < 0 ||
        targetIndex >= surfaceTests.length
      ) {
        return NextResponse.json({
          success: true,
        });
      }

      /*
       * Swap the two tests in memory.
       */
      const reordered = [...surfaceTests];

      [reordered[currentIndex], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[currentIndex],
      ];

      /*
       * Renumber the entire surface 1, 2, 3...
       *
       * This also fixes old tests that currently have
       * sortOrder 0, duplicates or gaps.
       */
      await prisma.$transaction(
        reordered.map((test, index) =>
          prisma.testDefinition.update({
            where: {
              id: test.id,
            },
            data: {
              sortOrder: index + 1,
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
      });
    }

    /*
     * Normal edit/update.
     */
    const {
      surface,
      name,
      description,
      steps,
      expectedResult,
      sortOrder,
      isActive,
    } = body;

    const updated =
      await prisma.testDefinition.update({
        where: {
          id: params.id,
        },
        data: {
          ...(surface !== undefined && {
            surface,
          }),

          ...(name !== undefined && {
            name,
          }),

          ...(description !== undefined && {
            description: description || null,
          }),

          ...(steps !== undefined && {
            steps: steps || null,
          }),

          ...(expectedResult !== undefined && {
            expectedResult:
              expectedResult || null,
          }),

          ...(sortOrder !== undefined && {
            sortOrder: Number(sortOrder),
          }),

          ...(isActive !== undefined && {
            isActive: Boolean(isActive),
          }),
        },
      });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "PATCH /api/test-definitions/[id] failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to update test definition.",
      },
      {
        status: 500,
      }
    );
  }
}