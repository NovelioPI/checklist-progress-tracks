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

export interface SectionProgress {
	name: string;
	line: number; // 0-based line index of the heading line in the source
	level: number; // heading level, 1-6 (number of '#' characters)
	tracks: TrackCount[];
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
const PLACEHOLDER_RE = /^([^\n:]+):\s*\[!progress_bar\]\s*$/i;
// Matches a placeholder line like "Label: [!progress_bar]". This plugin never
// rewrites the note, so the placeholder text in the source never changes --
// it's purely a rendering hook, always safe to leave in place.

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagRegex(tag: string): RegExp {
	return new RegExp("#" + escapeRegExp(tag) + "(?:\\b|$)", "i");
}

interface RawSection {
	name: string;
	start: number;
	end: number;
	line: number;
	level: number;
}

/**
 * Find heading-based section boundaries. Any ATX heading (#..######) starts a
 * new section, ending where the next heading (of any level) begins -- headings
 * are treated as flat, sequential boundaries rather than a nested outline, so
 * a checkbox is always scoped to the single nearest heading above it.
 * Returns [{name, start, end, line, level}]. end is exclusive.
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
			current = { name: m[2].trim(), start: i, end: lines.length, line: i, level: m[1].length };
		}
	}
	if (current) sections.push(current);
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

/**
 * Parse a full note's text into per-section, per-track checked/total counts,
 * counting every checkbox in the section (whether or not a placeholder line
 * exists for its track -- the placeholder only controls what gets *rendered*).
 */
export function parseFile(text: string, settings: ChecklistProgressSettings): SectionProgress[] {
	const lines = text.split("\n");
	const sections = findSections(lines);
	const result: SectionProgress[] = [];

	for (const sec of sections) {
		const counts = new Map<string, TrackCount>();
		const ensure = (label: string): TrackCount => {
			let c = counts.get(label);
			if (!c) {
				c = { label, checked: 0, total: 0 };
				counts.set(label, c);
			}
			return c;
		};

		for (let i = sec.start; i < sec.end; i++) {
			const cb = CHECKBOX_RE.exec(lines[i]);
			if (!cb) continue;
			const checked = cb[2].toLowerCase() === "x";
			const label = resolveTrackLabel(cb[4], settings);
			if (label === null) continue; // #skip
			const c = ensure(label);
			c.total += 1;
			if (checked) c.checked += 1;
		}

		// Also make sure every track that has a placeholder line shows up,
		// even if it currently has 0 items (so it renders "n/a" rather than
		// being silently omitted).
		for (let i = sec.start; i < sec.end; i++) {
			const ph = PLACEHOLDER_RE.exec(lines[i]);
			if (ph) ensure(ph[1].trim());
		}

		result.push({
			name: sec.name,
			line: sec.line,
			level: sec.level,
			tracks: Array.from(counts.values()),
		});
	}

	return result;
}

/** Find placeholder lines within a section, in the order they appear. */
export function findPlaceholders(
	text: string,
	sectionStartLine: number,
	sectionEndLine: number
): { line: number; label: string; raw: string }[] {
	const lines = text.split("\n");
	const out: { line: number; label: string; raw: string }[] = [];
	for (let i = sectionStartLine; i < sectionEndLine && i < lines.length; i++) {
		const m = PLACEHOLDER_RE.exec(lines[i]);
		if (m) out.push({ line: i, label: m[1].trim(), raw: lines[i] });
	}
	return out;
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

export function isPlaceholderLine(line: string): { label: string } | null {
	const m = PLACEHOLDER_RE.exec(line);
	return m ? { label: m[1].trim() } : null;
}

export { PLACEHOLDER_RE, CHECKBOX_RE, SECTION_RE };
