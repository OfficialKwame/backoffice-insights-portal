import json
import sys
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = [
    "Invoiceid",
    "Businessid",
    "Businessname",
    "Createdat",
    "Totalamount",
    "Aggregatedamount",
    "Remindingamount",
    "Status",
    "Source",
]


def load_file(file_path: str) -> pd.DataFrame:
    path = Path(file_path)

    suffix = path.suffix.lower()

    if suffix == ".csv":
        return pd.read_csv(path)

    if suffix in [".xlsx", ".xls"]:
        return pd.read_excel(path)

    raise ValueError(
        f"Unsupported file type: {suffix}"
    )


def normalize_value(value):
    if pd.isna(value):
        return None

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass

    return value


def main():
    if len(sys.argv) < 2:
        raise ValueError(
            "A file path is required."
        )

    file_path = sys.argv[1]

    df = load_file(file_path)

    df.columns = [
        str(column).strip()
        for column in df.columns
    ]

    missing = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Missing required column(s): "
            + ", ".join(missing)
        )

    rows = []

    for _, row in df.iterrows():
        clean_row = {
            str(column): normalize_value(value)
            for column, value in row.items()
        }

        rows.append(clean_row)

    print(
        json.dumps(
            rows,
            ensure_ascii=False,
            default=str,
        )
    )


if __name__ == "__main__":
    main()