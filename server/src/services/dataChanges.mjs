const statusKey = "__crawlerStatus";

function serializeRow(row) {
    const values = Object.fromEntries(
        Object.entries(row)
            .filter(([key]) => key !== statusKey)
            .sort(([left], [right]) => left.localeCompare(right)),
    );
    return JSON.stringify(values);
}

export function markNewRows(previousRows, currentRows) {
    const previousCounts = new Map();
    for (const row of previousRows) {
        const key = serializeRow(row);
        previousCounts.set(key, (previousCounts.get(key) || 0) + 1);
    }

    const newRows = [];
    const existingRows = [];
    for (const row of currentRows) {
        const key = serializeRow(row);
        const previousCount = previousCounts.get(key) || 0;
        const cleanRow = Object.fromEntries(
            Object.entries(row).filter(([field]) => field !== statusKey),
        );

        if (previousCount > 0) {
            previousCounts.set(key, previousCount - 1);
            existingRows.push({ ...cleanRow, [statusKey]: "READ" });
        } else {
            newRows.push({ ...cleanRow, [statusKey]: "NEW" });
        }
    }

    return [...newRows, ...existingRows];
}

export function getCrawlerStatus(rows) {
    return Array.isArray(rows)
        && rows.some((row) => row?.[statusKey] === "NEW")
        ? "NEW"
        : "READ";
}
