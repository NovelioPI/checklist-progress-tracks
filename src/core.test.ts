import { describe, expect, it } from "vitest";
import {
	ChecklistProgressSettings,
	DEFAULT_SETTINGS,
	colorIndexForLabel,
	getTrackConfigWarnings,
	parseBarOptions,
	parseFile,
	specsForSection,
	statText,
	textBar,
} from "./core";

function settings(overrides: Partial<ChecklistProgressSettings> = {}): ChecklistProgressSettings {
	return {
		defaultTrackLabel: DEFAULT_SETTINGS.defaultTrackLabel,
		tracks: DEFAULT_SETTINGS.tracks.map((t) => ({ ...t })),
		skipTag: DEFAULT_SETTINGS.skipTag,
		barSegments: DEFAULT_SETTINGS.barSegments,
		...overrides,
	};
}

describe("parseFile", () => {
	it("counts checked and total checkboxes per section", () => {
		const text = ["# Heading", "- [x] done", "- [ ] not done", "- [X] also done"].join("\n");
		const sections = parseFile(text, settings());
		expect(sections).toHaveLength(1);
		expect(sections[0].tracks).toEqual([{ label: "Main", checked: 2, total: 3 }]);
	});

	it("routes tagged checkboxes to their configured track", () => {
		const text = ["# Heading", "- [x] task #b", "- [ ] task"].join("\n");
		const sections = parseFile(text, settings());
		const trackB = sections[0].tracks.find((t) => t.label === "Track B");
		const main = sections[0].tracks.find((t) => t.label === "Main");
		expect(trackB).toEqual({ label: "Track B", checked: 1, total: 1 });
		expect(main).toEqual({ label: "Main", checked: 0, total: 1 });
	});

	it("excludes checkboxes tagged with the skip tag entirely", () => {
		const text = ["# Heading", "- [x] task #skip", "- [ ] task"].join("\n");
		const sections = parseFile(text, settings());
		expect(sections[0].tracks).toEqual([{ label: "Main", checked: 0, total: 1 }]);
	});

	it("scopes a checkbox to the nearest heading above it, of any level", () => {
		const text = [
			"# Parent",
			"- [x] parent item",
			"## Child",
			"- [ ] child item",
			"- [ ] child item 2",
		].join("\n");
		const sections = parseFile(text, settings());
		const parent = sections.find((s) => s.name === "Parent")!;
		const child = sections.find((s) => s.name === "Child")!;
		expect(parent.tracks).toEqual([{ label: "Main", checked: 1, total: 1 }]);
		expect(child.tracks).toEqual([{ label: "Main", checked: 0, total: 2 }]);
	});

	it("rolls up nested subsections only for the rollup option", () => {
		const text = [
			"# Parent",
			"Main: [!progress_bar rollup]",
			"- [x] parent item",
			"## Child",
			"- [ ] child item",
		].join("\n");
		const sections = parseFile(text, settings());
		const parent = sections.find((s) => s.name === "Parent")!;
		expect(parent.tracks).toEqual([{ label: "Main", checked: 1, total: 1 }]);
		expect(parent.rollupTracks).toEqual([{ label: "Main", checked: 1, total: 2 }]);
		expect(parent.bars[0].count).toEqual({ label: "Main", checked: 1, total: 2 });
	});

	it("ignores headings and checkboxes inside fenced code blocks", () => {
		const text = [
			"# Real Heading",
			"- [x] real item",
			"```python",
			"# not a heading",
			"- [ ] not a checkbox either",
			"```",
			"- [ ] another real item",
		].join("\n");
		const sections = parseFile(text, settings());
		expect(sections).toHaveLength(1);
		expect(sections[0].name).toBe("Real Heading");
		expect(sections[0].tracks).toEqual([{ label: "Main", checked: 1, total: 2 }]);
	});

	it("resumes normal parsing after a closed code fence", () => {
		const text = [
			"# A",
			"```",
			"# still inside fence",
			"```",
			"# B",
			"- [x] item under B",
		].join("\n");
		const sections = parseFile(text, settings());
		expect(sections.map((s) => s.name)).toEqual(["A", "B"]);
		expect(sections.find((s) => s.name === "B")!.tracks).toEqual([
			{ label: "Main", checked: 1, total: 1 },
		]);
	});
});

describe("parseBarOptions", () => {
	it("defaults to no options when the argument list is empty", () => {
		expect(parseBarOptions("")).toEqual({
			rollup: false,
			track: null,
			goal: null,
			color: null,
			format: "both",
		});
	});

	it("parses a full argument list", () => {
		const opts = parseBarOptions('rollup goal=80 color=green format=count track="Other"');
		expect(opts).toEqual({
			rollup: true,
			track: "Other",
			goal: 80,
			color: "var(--color-green)",
			format: "count",
		});
	});

	it("treats rollup=false as off", () => {
		expect(parseBarOptions("rollup=false").rollup).toBe(false);
	});

	it("clamps goal to [0, 100]", () => {
		expect(parseBarOptions("goal=150").goal).toBe(100);
		expect(parseBarOptions("goal=-10").goal).toBe(0);
	});

	it("ignores unparseable values instead of failing the whole line", () => {
		expect(parseBarOptions("goal=notanumber format=bogus").goal).toBeNull();
		expect(parseBarOptions("goal=notanumber format=bogus").format).toBe("both");
	});
});

describe("statText / textBar", () => {
	it("reports n/a for an empty track", () => {
		expect(statText({ label: "x", checked: 0, total: 0 }, "both")).toBe("n/a");
		expect(textBar(0, 0, 10)).toBe("░░░░░░░░░░  n/a");
	});

	it("formats percent, count, and remaining", () => {
		const track = { label: "x", checked: 3, total: 4 };
		expect(statText(track, "percent")).toBe("75%");
		expect(statText(track, "count")).toBe("3/4");
		expect(statText(track, "remaining")).toBe("1 left");
		expect(statText({ label: "x", checked: 4, total: 4 }, "remaining")).toBe("done");
	});
});

describe("colorIndexForLabel", () => {
	it("gives the default track index 0 and configured tracks their settings order", () => {
		const s = settings({ tracks: [{ label: "B", tag: "b" }, { label: "C", tag: "c" }] });
		expect(colorIndexForLabel(s.defaultTrackLabel, s)).toBe(0);
		expect(colorIndexForLabel("B", s)).toBe(1);
		expect(colorIndexForLabel("C", s)).toBe(2);
	});
});

describe("specsForSection", () => {
	it("falls back to one bar per discovered track when no placeholder is declared", () => {
		const text = ["# Heading", "- [x] item"].join("\n");
		const sections = parseFile(text, settings());
		const specs = specsForSection(sections[0], settings());
		expect(specs).toHaveLength(1);
		expect(specs[0].label).toBe("Main");
	});

	it("uses the declared placeholders when present", () => {
		const text = ["# Heading", "- [x] item", "Main: [!progress_bar]"].join("\n");
		const sections = parseFile(text, settings());
		const specs = specsForSection(sections[0], settings());
		expect(specs).toHaveLength(1);
		expect(specs[0].line).toBe(2);
	});
});

describe("getTrackConfigWarnings", () => {
	it("has no warnings for a clean config", () => {
		expect(getTrackConfigWarnings(settings())).toEqual([]);
	});

	it("flags two tracks sharing a tag", () => {
		const s = settings({ tracks: [{ label: "B", tag: "x" }, { label: "C", tag: "x" }] });
		expect(getTrackConfigWarnings(s).some((w) => w.includes("Tag"))).toBe(true);
	});

	it("flags a track tag equal to the skip tag", () => {
		const s = settings({ tracks: [{ label: "B", tag: "skip" }] });
		expect(getTrackConfigWarnings(s).some((w) => w.includes("skip tag"))).toBe(true);
	});

	it("flags two tracks sharing a label", () => {
		const s = settings({ tracks: [{ label: "Same", tag: "a" }, { label: "Same", tag: "b" }] });
		expect(getTrackConfigWarnings(s).some((w) => w.includes("Label"))).toBe(true);
	});

	it("flags a track label matching the default track label", () => {
		const s = settings({ tracks: [{ label: "Main", tag: "a" }] });
		expect(getTrackConfigWarnings(s).some((w) => w.includes("default track label"))).toBe(true);
	});
});
