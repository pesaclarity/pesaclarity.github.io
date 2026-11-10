// The version, sizes and what's new shown with the download buttons.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assetSizes,
  describeRelease,
  fetchAppRelease,
  formatDay,
  formatSize,
  plainChange,
  recentChanges,
} from "../src/data/release.mjs";

const apk = (updated, size = 19448038) => ({
  name: "pesaclarity-play.apk",
  updated_at: updated,
  size,
});

// A made-up release body in the shape the app's APK workflow writes.
const body = [
  "The newest build from `dev`: 0.5.0-dev.3, commit abc1234.",
  "",
  "- `pesaclarity-play.apk`: the Google Play flavour, for most phones.",
  "",
  "## Recent changes",
  "",
  "- ci: run the UI flows on every pull request (#210)",
  "- feat: sell from item tiles or the number pad (#209)",
  "- fix(sms): read `Equity` messages in USD (#208)",
  "- docs: a new README section (#207)",
  "- feat!: one drop-down for each filter (#206)",
  "- build: smaller APKs (#205)",
  "- feat: sell from item tiles or the number pad (#204)",
  "- refactor: tidy the books (#203)",
  "* fix: close the day matches each payment. (#202)",
  "",
  "Built by https://github.com/example/actions/runs/1",
  "",
  "## Checksums",
  "",
  "- feat: this list is not changes (#1)",
].join("\n");

test("a test build shows its build name and when the APK changed", () => {
  assert.deepEqual(
    describeRelease({
      name: "Test build 0.4.0-dev.12",
      tag_name: "test-build",
      published_at: "2026-10-01T00:00:00Z",
      assets: [apk("2026-11-03T09:00:00Z")],
    }),
    {
      version: "0.4.0-dev.12",
      date: "2026-11-03T09:00:00Z",
      changes: [],
      sizes: { "pesaclarity-play.apk": 19448038 },
    },
  );
});

test("a full release shows its tag without the v", () => {
  assert.deepEqual(
    describeRelease({
      name: "",
      tag_name: "v0.4.0",
      assets: [apk("2026-11-04T00:00:00Z")],
    }),
    {
      version: "0.4.0",
      date: "2026-11-04T00:00:00Z",
      changes: [],
      sizes: { "pesaclarity-play.apk": 19448038 },
    },
  );
});

test("a release without the APK shows nothing", () => {
  assert.equal(describeRelease({ name: "Test build 1", assets: [] }), null);
  assert.equal(describeRelease(null), null);
});

test("days are in Nairobi time", () => {
  assert.equal(formatDay("2026-11-02T22:30:00Z"), "3 Nov 2026");
  assert.equal(formatDay("not a date"), null);
});

test("no network, or a missing release, shows nothing", async () => {
  const failing = async () => {
    throw new Error("offline");
  };
  assert.equal(
    await fetchAppRelease("test-build", { fetchImpl: failing }),
    null,
  );
  const missing = async () => ({ ok: false });
  assert.equal(await fetchAppRelease("v9.9.9", { fetchImpl: missing }), null);
});

test("a commit title becomes plain words", () => {
  assert.equal(
    plainChange(
      "feat: business follow-ups for reports, tax and documents (#176)",
    ),
    "Business follow-ups for reports, tax and documents",
  );
  assert.equal(
    plainChange("fix(sms): read `Equity` messages in USD (#208)"),
    "Read Equity messages in USD",
  );
  assert.equal(plainChange("feat!: one drop-down (#206)"), "One drop-down");
  assert.equal(plainChange("Fix: a title in capitals."), "A title in capitals");
});

test("only changes people see in the app count", () => {
  for (const title of [
    "ci: check the foss APKs build reproducibly (#185)",
    "build: compress native libraries (#182)",
    "docs: privacy policy 1.7 (#181)",
    "refactor: tidy (#1)",
    "a title with no type",
    "",
  ]) {
    assert.equal(plainChange(title), null, title);
  }
});

test("what's new comes from the Recent changes list, newest first", () => {
  assert.deepEqual(recentChanges(body), [
    "Sell from item tiles or the number pad",
    "Read Equity messages in USD",
    "One drop-down for each filter",
    "Close the day matches each payment",
  ]);
  assert.deepEqual(recentChanges(body, 2), [
    "Sell from item tiles or the number pad",
    "Read Equity messages in USD",
  ]);
});

test("a body with no Recent changes, or none at all, has nothing new", () => {
  assert.deepEqual(recentChanges("Just a note.\n\n- feat: x (#1)"), []);
  assert.deepEqual(recentChanges(null), []);
  assert.deepEqual(recentChanges(undefined), []);
});

test("each file's size comes from the release assets", () => {
  const release = {
    name: "Test build 0.5.0-dev.3",
    body,
    assets: [
      apk("2026-11-10T09:00:00Z"),
      { name: "pesaclarity-play-32bit.apk", size: 18325496 },
      { name: "pesaclarity-foss.apk", size: 0 },
      { name: "pesaclarity-foss-32bit.apk" },
    ],
  };
  assert.deepEqual(assetSizes(release), {
    "pesaclarity-play.apk": 19448038,
    "pesaclarity-play-32bit.apk": 18325496,
  });
  const described = describeRelease(release);
  assert.equal(described?.version, "0.5.0-dev.3");
  assert.equal(described?.changes.length, 4);
  assert.deepEqual(assetSizes(null), {});
});

test("sizes read in MB, as phones show them", () => {
  assert.equal(formatSize(19448038), "19.4 MB");
  assert.equal(formatSize(15342581), "15.3 MB");
  assert.equal(formatSize(960000), "1.0 MB");
  assert.equal(formatSize(0), null);
  assert.equal(formatSize(NaN), null);
  assert.equal(formatSize(undefined), null);
});

test("a release read over the network keeps its changes and sizes", async () => {
  const ok = async () => ({
    ok: true,
    json: async () => ({
      name: "Test build 0.5.0-dev.3",
      body,
      assets: [apk("2026-11-10T09:00:00Z")],
    }),
  });
  const release = await fetchAppRelease("test-build", { fetchImpl: ok });
  assert.equal(release?.version, "0.5.0-dev.3");
  assert.equal(release?.changes[0], "Sell from item tiles or the number pad");
  assert.equal(release?.sizes["pesaclarity-play.apk"], 19448038);
});
