// Shared parsing + progress computation. No Obsidian API dependency here,
// so it's easy to reason about / unit-test in isolation.

export interface TrackConfig {
	/** The exact label that appears before ": [!progress_bar]" in the note, e.g. "Track B". */
	label: string;
	/** The #tag (without '#') that routes a checkbox to this track, e.g. "cp". */
	tag: string;
}

export interface ChecklistProgressSettings {
	/** Label used for checkboxes that carry no recognized track tag. */
	defaultTrackLabel: string;
	/** Additional tracks, each selected by its own #tag. */
	tracks: TrackConfig[];
	/** Tag (without '#') that excludes a checkbox from every track's totals. */
	skipTag: string;
	/** Bar length in characters, used only for text fallback / dashboard summaries. */
	barSegments: number;
}

export const DEFAULT_SETTINGS: ChecklistProgressSettings = {
	defaultTrackLabel: "Main",
	tracks: [{ label: "Track B", tag: "b" }],
	skipTag: "skip",
	barSegments: 20,
};

export interface TrackCount {
	label: string;
	checked: number;
	total: number;
}

/** How the numeric readout to the right of a bar is worded. */
export type StatFormat = "both" | "percent" | "count" | "remaining";

/**
 * Options parsed out of a placeholder line's argument list, e.g.
 * "Main: [!progress_bar rollup goal=80 color=green format=count]".
 */
export interface BarOptions {
	/** Count checkboxes in nested subsections too, not just this heading's own body. */
	rollup: boolean;
	/**
	 * Track to count, when it differs from the placeholder's own label -- so a bar
	 * can read "Total:" while still counting the "Main" track. Null means the
	 * label itself names the track.
	 */
	track: string | null;
	/** Target percentage (0-100) to mark on the bar, or null for no target. */
	goal: number | null;
	/** CSS color overriding the default per-track color, or null. */
	color: string | null;
	/** Wording of the numeric readout. */
	format: StatFormat;
}

export const DEFAULT_BAR_OPTIONS: BarOptions = {
	rollup: false,
	track: null,
	goal: null,
	color: null,
	format: "both",
};

/** One placeholder line in a note, resolved against the counts it should display. */
export interface BarSpec {
	/** 0-based line index of the placeholder line in the source. */
	line: number;
	label: string;
	options: BarOptions;
	/** Counts honoring options.rollup. */
	count: TrackCount;
	/** Stable color slot for this track, derived from settings order. */
	colorIndex: number;
}

export interface SectionProgress {
	name: string;
	line: number; // 0-based line index of the heading line in the source
	level: number; // heading level, 1-6 (number of '#' characters)
	/** Counts for this heading's own body, up to the next heading of any level. */
	tracks: TrackCount[];
	/** Counts including nested subsections, up to the next heading of equal or higher rank. */
	rollupTracks: TrackCount[];
	/** Placeholder lines declared in this heading's own body, in source order. */
	bars: BarSpec[];
}

export interface FileProgress {
	path: string;
	sections: SectionProgress[];
}

// Any ATX heading level (#, ##, ###, ####, #####, ######) starts a new section --
// not tied to a specific level, so this works with whatever heading structure a
// note already uses.
const SECTION_RE = /^(#{1,6})\s+(.+?)\s*$/;
const CHECKBOX_RE = /^(\s*-\s\[)([ xX])(\]\s*)(.*)$/;
// Matches a placeholder line like "Label: [!progress_bar]", optionally followed
// by a space-separated argument list ("[!progress_bar rollup goal=80]"). This
// plugin never rewrites the note, so the placeholder text in the source never
// changes -- it's purely a rendering hook, always safe to leave in place.
const PLACEHOLDER_RE = /^([^\n:]+):\s*\[!progress_bar\s*([^\]\n]*)\]\s*$/i;
// One "key", "key=value", "key='value'" or "key=\"value\"" token in that list.
const OPTION_RE = /([A-Za-z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?/g;

/** Named colors map onto Obsidian's theme palette; anything else is passed through as CSS. */
const NAMED_COLORS: Record<string, string> = {
	red: "var(--color-red)",
	orange: "var(--color-orange)",
	yellow: "var(--color-yellow)",
	green: "var(--color-green)",
	cyan: "var(--color-cyan)",
	blue: "var(--color-blue)",
	purple: "var(--color-purple)",
	pink: "var(--color-pink)",
	accent: "var(--interactive-accent)",
};

// Conservative allowlist so a stray placeholder can't inject arbitrary CSS
// declarations into the style attribute.
const SAFE_COLOR_RE = /^[\w\s#(),.%-]+$/;

const STAT_FORMATS: StatFormat[] = ["both", "percent", "count", "remaining"];

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagRegex(tag: string): RegExp {
	return new RegExp("#" + escapeRegExp(tag) + "(?:\\b|$)", "i");
}

/**
 * Parse a placeholder's argument list. Unknown keys and unparseable values are
 * ignored rather than failing the whole line, so a typo degrades to a plain bar
 * instead of making the placeholder disappear.
 */
export function parseBarOptions(raw: string): BarOptions {
	const opts: BarOptions = { ...DEFAULT_BAR_OPTIONS };
	if (!raw || !raw.trim()) return opts;

	OPTION_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = OPTION_RE.exec(raw)) !== null) {
		const key = m[1].toLowerCase();
		const value = m[2] ?? m[3] ?? m[4] ?? null;

		switch (key) {
			case "rollup":
				// Bare "rollup" means on; "rollup=false" turns it back off.
				opts.rollup = value === null || !/^(false|no|0|off)$/i.test(value);
				break;
			case "track": {
				if (value !== null && value.trim()) opts.track = value.trim();
				break;
			}
			case "goal": {
				if (value === null) break;
				const n = Number.parseFloat(value.replace(/%$/, ""));
				if (Number.isFinite(n)) opts.goal = Math.min(100, Math.max(0, n));
				break;
			}
			case "color": {
				if (value === null) break;
				const named = NAMED_COLORS[value.toLowerCase()];
				if (named) opts.color = named;
				else if (SAFE_COLOR_RE.test(value)) opts.color = value;
				break;
			}
			case "format": {
				if (value === null) break;
				const f = value.toLowerCase() as StatFormat;
				if (STAT_FORMATS.includes(f)) opts.format = f;
				break;
			}
		}
	}

	return opts;
}

interface RawSection {
	name: string;
	start: number;
	/** Exclusive end of this heading's own body: the next heading of any level. */
	end: number;
	/** Exclusive end including nested subsections: the next heading of equal or higher rank. */
	rollupEnd: number;
	line: number;
	level: number;
}

/**
 * Find heading-based section boundaries. Any ATX heading (#..######) starts a
 * new section, ending where the next heading (of any level) begins -- headings
 * are treated as flat, sequential boundaries, so a checkbox is always scoped to
 * the single nearest heading above it.
 *
 * Each section also records `rollupEnd`, which extends through nested
 * subsections up to the next heading of equal or higher rank. That range backs
 * the "rollup" placeholder option, so a parent heading can total up everything
 * beneath it without changing the default scoping.
 */
function findSections(lines: string[]): RawSection[] {
	const sections: RawSection[] = [];
	let current: RawSection | null = null;
	for (let i = 0; i < lines.length; i++) {
		const m = SECTION_RE.exec(lines[i]);
		if (m) {
			if (current) {
				current.end = i;
				sections.push(current);
			}
			current = {
				name: m[2].trim(),
				start: i,
				end: lines.length,
				rollupEnd: lines.length,
				line: i,
				level: m[1].length,
			};
		}
	}
	if (current) sections.push(current);

	// Second pass: a section's rollup range runs until the next heading that is
	// a sibling or an ancestor (level <= its own).
	for (let i = 0; i < sections.length; i++) {
		let end = lines.length;
		for (let j = i + 1; j < sections.length; j++) {
			if (sections[j].level <= sections[i].level) {
				end = sections[j].start;
				break;
			}
		}
		sections[i].rollupEnd = end;
	}

	return sections;
}

/** Which track a checkbox line belongs to, or null if it's tagged with the skip tag. */
function resolveTrackLabel(checkboxText: string, settings: ChecklistProgressSettings): string | null {
	if (tagRegex(settings.skipTag).test(checkboxText)) return null;
	for (const t of settings.tracks) {
		if (tagRegex(t.tag).test(checkboxText)) return t.label;
	}
	return settings.defaultTrackLabel;
}

/** Tally every checkbox in [from, to) into per-track counts. */
function countRange(
	lines: string[],
	from: number,
	to: number,
	settings: ChecklistProgressSettings
): Map<string, TrackCount> {
	const counts = new Map<string, TrackCount>();
	for (let i = from; i < to && i < lines.length; i++) {
		const cb = CHECKBOX_RE.exec(lines[i]);
		if (!cb) continue;
		const label = resolveTrackLabel(cb[4], settings);
		if (label === null) continue; // #skip
		let c = counts.get(label);
		if (!c) {
			c = { label, checked: 0, total: 0 };
			counts.set(label, c);
		}
		c.total += 1;
		if (cb[2].toLowerCase() === "x") c.checked += 1;
	}
	return counts;
}

function ensureCount(counts: Map<string, TrackCount>, label: string): TrackCount {
	let c = counts.get(label);
	if (!c) {
		c = { label, checked: 0, total: 0 };
		counts.set(label, c);
	}
	return c;
}

/**
 * Stable color slot for a track: the default track is 0 and configured tracks
 * follow in settings order, so a track keeps its color regardless of the order
 * its placeholder lines happen to appear in. Labels with no matching track fall
 * back to a hash so they at least stay consistent with themselves.
 */
export function colorIndexForLabel(label: string, settings: ChecklistProgressSettings): number {
	if (label === settings.defaultTrackLabel) return 0;
	const i = settings.tracks.findIndex((t) => t.label === label);
	if (i !== -1) return i + 1;
	let h = 0;
	for (let k = 0; k < label.length; k++) h = (h * 31 + label.charCodeAt(k)) | 0;
	return Math.abs(h);
}

/**
 * Parse a full note's text into per-section, per-track checked/total counts,
 * counting every checkbox in the section (whether or not a placeholder line
 * exists for its track -- the placeholder only controls what gets *rendered*),
 * plus the resolved placeholder lines themselves.
 */
export function parseFile(text: string, settings: ChecklistProgressSettings): SectionProgress[] {
	const lines = text.split("\n");
	const sections = findSections(lines);
	const result: SectionProgress[] = [];

	for (const sec of sections) {
		const flat = countRange(lines, sec.start, sec.end, settings);
		// Only pay for the second pass when the section actually has children.
		const rollup =
			sec.rollupEnd === sec.end ? flat : countRange(lines, sec.start, sec.rollupEnd, settings);

		// Placeholders are discovered in the section's own body, so a placeholder
		// under a subsection belongs to that subsection, not to its parent.
		const bars: BarSpec[] = [];
		for (let i = sec.start; i < sec.end && i < lines.length; i++) {
			const ph = PLACEHOLDER_RE.exec(lines[i]);
			if (!ph) continue;
			const label = ph[1].trim();
			const options = parseBarOptions(ph[2] ?? "");
			// "track=" lets the displayed label differ from the track being counted.
			const countLabel = options.track ?? label;

			// Make sure a declared track shows up even with 0 items, so it renders
			// "n/a" rather than being silently omitted.
			const flatCount = ensureCount(flat, countLabel);
			const rollupCount = rollup === flat ? flatCount : ensureCount(rollup, countLabel);
			const source = options.rollup ? rollupCount : flatCount;

			bars.push({
				line: i,
				label,
				options,
				// Display the placeholder's own label, but the counted track's numbers.
				count: { ...source, label },
				colorIndex: colorIndexForLabel(countLabel, settings),
			});
		}

		result.push({
			name: sec.name,
			line: sec.line,
			level: sec.level,
			tracks: Array.from(flat.values()),
			rollupTracks: Array.from(rollup.values()),
			bars,
		});
	}

	return result;
}

/**
 * The bars to render for a section: the placeholders it declares, or -- when it
 * declares none -- one bar per track found, which is what the dashboard shows.
 */
export function specsForSection(
	sec: SectionProgress,
	settings: ChecklistProgressSettings
): BarSpec[] {
	if (sec.bars.length > 0) return sec.bars;
	return sec.tracks.map((t) => ({
		line: sec.line,
		label: t.label,
		options: { ...DEFAULT_BAR_OPTIONS },
		count: t,
		colorIndex: colorIndexForLabel(t.label, settings),
	}));
}

export function percentOf(checked: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((100 * checked) / total);
}

export function textBar(checked: number, total: number, segments: number): string {
	if (total === 0) return "░".repeat(segments) + "  n/a";
	const pct = percentOf(checked, total);
	const filled = Math.min(segments, Math.max(0, Math.round((segments * checked) / total)));
	return "█".repeat(filled) + "░".repeat(segments - filled) + `  ${pct}% (${checked}/${total})`;
}

/** The numeric readout to the right of a bar, worded per the format option. */
export function statText(count: TrackCount, format: StatFormat): string {
	if (count.total === 0) return "n/a";
	const pct = percentOf(count.checked, count.total);
	switch (format) {
		case "percent":
			return `${pct}%`;
		case "count":
			return `${count.checked}/${count.total}`;
		case "remaining": {
			const left = count.total - count.checked;
			return left === 0 ? "done" : `${left} left`;
		}
		default:
			return `${pct}% (${count.checked}/${count.total})`;
	}
}

export function isPlaceholderLine(line: string): { label: string; options: BarOptions } | null {
	const m = PLACEHOLDER_RE.exec(line);
	if (!m) return null;
	return { label: m[1].trim(), options: parseBarOptions(m[2] ?? "") };
}

export { PLACEHOLDER_RE, CHECKBOX_RE, SECTION_RE };
