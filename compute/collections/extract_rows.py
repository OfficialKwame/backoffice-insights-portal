from pathlib import Path
import sys
import warnings

import pandas as pd


def load_file(file_path: str) -> pd.DataFrame:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = path.suffix.lower()

    if suffix == ".csv":
        return pd.read_csv(path)

    if suffix in [".xlsx", ".xls"]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            return pd.read_excel(path)

    raise ValueError("Only CSV and Excel files are supported.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(
            "Usage: python3 compute/collections/extract_rows.py "
            "<path-to-data-file>"
        )
        sys.exit(1)

    df = load_file(sys.argv[1])

    required = ["ID", "Paymentdate"]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required column(s): {', '.join(missing)}"
        )

    print(
        df.to_json(
            orient="records",
            date_format="iso",
        )
    )