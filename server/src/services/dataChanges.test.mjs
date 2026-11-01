import assert from "node:assert/strict";
import test from "node:test";
import { getCrawlerStatus, getNewRows, markNewRows } from "./dataChanges.mjs";

test("marks newly discovered rows and puts them before existing rows", () => {
    const rows = markNewRows(
        [{ name: "Existing", url: "https://example.com/1" }],
        [
            { name: "Existing", url: "https://example.com/1" },
            { name: "New", url: "https://example.com/2" },
        ],
    );

    assert.deepEqual(rows, [
        {
            name: "New",
            url: "https://example.com/2",
            __crawlerStatus: "NEW",
        },
        {
            name: "Existing",
            url: "https://example.com/1",
            __crawlerStatus: "READ",
        },
    ]);
});

test("clears NEW from rows that remain on the next crawl", () => {
    const rows = markNewRows(
        [{ name: "New", __crawlerStatus: "NEW" }],
        [{ name: "New" }],
    );

    assert.deepEqual(rows, [{ name: "New", __crawlerStatus: "READ" }]);
});

test("matches duplicate rows by count", () => {
    const rows = markNewRows(
        [{ name: "Same" }],
        [{ name: "Same" }, { name: "Same" }],
    );

    assert.equal(rows.filter((row) => row.__crawlerStatus === "NEW").length, 1);
});

test("reports NEW when the latest crawl contains new rows and READ otherwise", () => {
    assert.equal(getCrawlerStatus([{ __crawlerStatus: "NEW" }]), "NEW");
    assert.equal(getCrawlerStatus([{ name: "Existing" }]), "READ");
    assert.equal(getCrawlerStatus([]), "READ");
});

test("returns only NEW rows for scheduled notifications", () => {
    assert.deepEqual(
        getNewRows([
            { name: "New", __crawlerStatus: "NEW" },
            { name: "Existing", __crawlerStatus: "READ" },
        ]),
        [{ name: "New", __crawlerStatus: "NEW" }],
    );
    assert.deepEqual(getNewRows(null), []);
});
