type SurfaceTestingActivity = {
  runsCompleted: number;
  checksCompleted: number;
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
  surfaces: string[];
  issues: {
    surface: string;
    testName: string;
    result: string;
    note: string | null;
    issueReference: string | null;
  }[];
};

type DesignDriftActivity = {
  reviewsCompleted: number;
  areasReviewed: number;
  surfacesReviewed: string[];
  itemsRaised: number;
  itemsCreated: {
    id: string;
    surface: string;
    area: string;
    title: string;
    severity: string;
    status: string;
    raisedTo: string | null;
  }[];
  itemsUpdated: {
    id: string;
    surface: string;
    area: string;
    title: string;
    severity: string;
    status: string;
    raisedTo: string | null;
  }[];
};

type CollectionsActivity = {
  importsCompleted: number;
  rowsImported: number;
  imports: {
    id: string;
    fileName: string;
    rowCount: number;
    importedMinDate: string | Date | null;
    importedMaxDate: string | Date | null;
    period: {
      id: string;
      periodStart: string | Date;
      periodEnd: string | Date;
      daysCovered: number;
      expectedDays: number;
      isComplete: boolean;
    } | null;
  }[];
};

type ManualActivity = {
  id: string;
  category: string;
  action: string;
  description: string | null;
  activityDate: string | Date;
};

export type DailyActivitySource = {
  date: string;
  surfaceTesting: SurfaceTestingActivity;
  designDrift: DesignDriftActivity;
  collections: CollectionsActivity;
  activityLog: {
    total: number;
    activities: ManualActivity[];
  };
};

function surfaceLabel(surface: string) {
  const labels: Record<string, string> = {
    LITE: "BackOffice Lite App",
    LITE_PORTAL: "BackOffice Lite Portal",
    APP: "BackOffice App",
    PORTAL: "BackOffice Portal",
  };

  return labels[surface] ?? surface;
}

function joinList(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} and ${
    items[items.length - 1]
  }`;
}

function buildSurfaceTestingActivity(
  activity: SurfaceTestingActivity
) {
  if (activity.checksCompleted === 0) {
    return null;
  }

  const surfaces = activity.surfaces.map(surfaceLabel);

  let sentence = `Completed ${
    activity.checksCompleted
  } Surface Testing ${
    activity.checksCompleted === 1 ? "check" : "checks"
  }`;

  if (surfaces.length > 0) {
    sentence += ` across ${joinList(surfaces)}`;
  }

  const outcomes: string[] = [];

  if (activity.passed > 0) {
    outcomes.push(`${activity.passed} passed`);
  }

  if (activity.failed > 0) {
    outcomes.push(`${activity.failed} failed`);
  }

  if (activity.blocked > 0) {
    outcomes.push(`${activity.blocked} blocked`);
  }

  if (outcomes.length > 0) {
    sentence += `, with ${joinList(outcomes)}`;
  }

  return `${sentence}.`;
}

function buildDesignDriftActivity(
  activity: DesignDriftActivity
) {
  const parts: string[] = [];

  if (activity.reviewsCompleted > 0) {
    let reviewText = `Completed ${
      activity.reviewsCompleted
    } Design Drift ${
      activity.reviewsCompleted === 1 ? "review" : "reviews"
    }`;

    if (activity.surfacesReviewed.length > 0) {
      reviewText += ` across ${joinList(
        activity.surfacesReviewed.map(surfaceLabel)
      )}`;
    }

    parts.push(reviewText);
  }

  if (activity.itemsRaised > 0) {
    parts.push(
      `logged ${activity.itemsRaised} new drift ${
        activity.itemsRaised === 1 ? "item" : "items"
      }`
    );
  }

  if (activity.itemsUpdated.length > 0) {
    parts.push(
      `updated ${activity.itemsUpdated.length} existing drift ${
        activity.itemsUpdated.length === 1 ? "item" : "items"
      }`
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return `${parts.join(" and ")}.`;
}

function buildCollectionsActivity(
  activity: CollectionsActivity
) {
  if (activity.importsCompleted === 0) {
    return null;
  }

  if (activity.importsCompleted === 1) {
    return `Updated Collections Performance with the latest data import covering ${activity.rowsImported.toLocaleString()} transaction rows.`;
  }

  return `Updated Collections Performance with ${activity.importsCompleted} data imports covering ${activity.rowsImported.toLocaleString()} transaction rows.`;
}

function buildManualActivity(activity: ManualActivity) {
  const action = activity.action.trim();
  const description = activity.description?.trim();

  if (description) {
    return `${description}.`;
  }

  return `${action}.`;
}




export function buildDailyLine(
  source: DailyActivitySource
) {
  const sentences: string[] = [];

  const surfaceTesting = buildSurfaceTestingActivity(
    source.surfaceTesting
  );

  if (surfaceTesting) {
    sentences.push(surfaceTesting);
  }

  const designDrift = buildDesignDriftActivity(
    source.designDrift
  );

  if (designDrift) {
    sentences.push(designDrift);
  }

  const collections = buildCollectionsActivity(
    source.collections
  );

  if (collections) {
    sentences.push(collections);
  }

  for (const activity of source.activityLog.activities) {
    sentences.push(buildManualActivity(activity));
  }

  if (sentences.length === 0) {
    return "No activity recorded today.";
  }

  return sentences.join(" ");
}