/*
  Print an exported report as a PDF that looks exactly
  like the screen.

  The report HTML (the same file as "Export HTML") is
  loaded into a hidden frame at desktop width. Once laid
  out, its full height is measured and a print page of
  exactly that size is set, so the browser prints it as
  one long page: no A4 page breaks, no rearranged grids,
  and the dark background and colours kept.

  The browser's print dialog then opens with everything
  in place; choose "Save as PDF".
*/

// Width the report is laid out at, in CSS pixels. Wide
// enough for the desktop (xl) layouts of the report.
const REPORT_WIDTH = 1440;

// Chrome cannot make a PDF page taller than about
// 200 inches (19,200 CSS pixels).
const MAX_PAGE_HEIGHT = 19000;

/*
  Collects the page's CSS so the report keeps its styling
  outside the portal.

  With skipPrintRules, any "@media print" rules are left
  out. The portal's global stylesheet has older print
  rules (A4 landscape pages, rearranged grids) that would
  otherwise distort the PDF.
*/
export function getEmbeddedStyles(skipPrintRules = false) {
  let css = "";

  Array.from(document.styleSheets).forEach((styleSheet) => {
    try {
      Array.from(styleSheet.cssRules ?? []).forEach((rule) => {
        if (
          skipPrintRules &&
          typeof CSSMediaRule !== "undefined" &&
          rule instanceof CSSMediaRule &&
          /\bprint\b/i.test(rule.media.mediaText)
        ) {
          return;
        }

        css += `${rule.cssText}\n`;
      });
    } catch (error) {
      console.warn(
        "Could not embed stylesheet:",
        styleSheet.href,
        error
      );
    }
  });

  return css;
}

function printStyles(height: number) {
  return `
    @page {
      size: ${REPORT_WIDTH}px ${height}px;
      margin: 0;
    }

    html, body, * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      width: ${REPORT_WIDTH}px !important;
    }
  `;
}

/*
  Locks in the desktop layout.

  When printing, Chrome judges the page width differently
  from the screen, so width-based layout rules (Tailwind's
  sm:, md:, lg:, xl:) can switch off and the report falls
  back to its narrow, stacked layout. Here every
  width-dependent rule is resolved once, at desktop width
  on screen: rules that apply are kept without their
  condition, and rules that don't are dropped. The printed
  report then has no width conditions left to misjudge.
*/
function flattenMediaRules(
  rules: CSSRuleList,
  win: Window
): string {
  let css = "";

  Array.from(rules).forEach((rule) => {
    if (
      typeof (win as any).CSSMediaRule !== "undefined" &&
      rule instanceof (win as any).CSSMediaRule
    ) {
      const mediaRule = rule as CSSMediaRule;
      const media = mediaRule.media.mediaText;

      // Print rules are handled separately; drop them.
      if (/\bprint\b/i.test(media)) {
        return;
      }

      if (win.matchMedia(media).matches) {
        css += flattenMediaRules(mediaRule.cssRules, win);
      }

      return;
    }

    css += `${rule.cssText}\n`;
  });

  return css;
}

function lockDesktopLayout(doc: Document, win: Window) {
  let css = "";

  Array.from(doc.styleSheets).forEach((sheet) => {
    try {
      css += flattenMediaRules(sheet.cssRules, win);
    } catch {
      // Cross-origin stylesheet: leave it in place.
      return;
    }

    sheet.ownerNode?.parentNode?.removeChild(sheet.ownerNode);
  });

  const style = doc.createElement("style");
  style.textContent = css;
  doc.head.appendChild(style);
}

function waitForLayout(frame: HTMLIFrameElement) {
  return new Promise<void>((resolve) => {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    const done = () => {
      // Two animation frames so layout has settled.
      win?.requestAnimationFrame(() =>
        win.requestAnimationFrame(() => resolve())
      );
    };

    if (doc?.fonts?.ready) {
      doc.fonts.ready.then(done, done);
    } else {
      setTimeout(done, 300);
    }
  });
}

/*
  Opens the print dialog for the given report HTML.

  title becomes the suggested PDF file name.
*/
export async function printReportAsPdf(
  html: string,
  title: string
) {
  const frame = document.createElement("iframe");

  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");

  Object.assign(frame.style, {
    position: "fixed",
    left: "-20000px",
    top: "0",
    width: `${REPORT_WIDTH}px`,
    height: "1000px",
    border: "0",
  });

  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;

  if (!doc || !win) {
    frame.remove();
    throw new Error("Could not prepare the report for printing.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  await waitForLayout(frame);

  lockDesktopLayout(doc, win);

  await waitForLayout(frame);

  const contentHeight = Math.ceil(
    Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0
    )
  );

  const pageHeight = Math.min(contentHeight + 2, MAX_PAGE_HEIGHT);

  const style = doc.createElement("style");
  style.textContent = printStyles(pageHeight);
  doc.head.appendChild(style);

  doc.title = title;

  // Chrome uses the top page's title as the default
  // PDF file name, so set it for the moment of printing.
  const previousTitle = document.title;
  document.title = title;

  let cleanedUp = false;

  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.title = previousTitle;
    frame.remove();
  };

  win.addEventListener("afterprint", () => {
    // Give the browser a moment to finish before removing.
    setTimeout(cleanUp, 500);
  });

  // Safety net in case "afterprint" never fires.
  setTimeout(cleanUp, 5 * 60 * 1000);

  win.focus();
  win.print();

  return {
    height: contentHeight,
    truncated: contentHeight + 2 > MAX_PAGE_HEIGHT,
  };
}
