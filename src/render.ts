import { BarOptions, BarSpec, DEFAULT_BAR_OPTIONS, TrackCount, percentOf, statText } from "./core";

/** Deterministic color per track slot, using theme-aware CSS vars where possible. */
const TRACK_COLOR_VARS = [
	"var(--interactive-accent)",
	"var(--color-orange, var(--text-warning))",
	"var(--color-green, var(--text-success))",
	"var(--color-purple, var(--text-accent))",
	"var(--color-pink, var(--text-error))",
];

export function colorForTrackIndex(i: number): string {
	return TRACK_COLOR_VARS[i % TRACK_COLOR_VARS.length];
}

/**
 * Build a single "<Label> [bar] 63% (12/19)" row as a DOM element.
 *
 * Presentational values are passed as CSS custom properties rather than
 * hardcoded style declarations, so themes and snippets can still override
 * everything from styles.css.
 */
export function buildBarRow(
	track: TrackCount,
	colorIndex: number,
	options: BarOptions = DEFAULT_BAR_OPTIONS
): HTMLElement {
	const row = createDiv();
	row.addClass("cpt-row");
	row.style.setProperty("--cpt-color", options.color ?? colorForTrackIndex(colorIndex));

	row.createSpan({ cls: "cpt-label", text: track.label + ":" });

	const pct = percentOf(track.checked, track.total);
	const stat = statText(track, options.format);

	const trackEl = row.createDiv({ cls: "cpt-track" });
	trackEl.setAttrs({
		role: "progressbar",
		"aria-valuemin": "0",
		"aria-valuemax": "100",
		"aria-valuenow": String(track.total === 0 ? 0 : pct),
		"aria-valuetext": stat,
		"aria-label": track.label,
	});

	const fill = trackEl.createDiv({ cls: "cpt-fill" });
	fill.style.setProperty("--cpt-pct", pct + "%");

	if (options.goal !== null) {
		const marker = trackEl.createDiv({ cls: "cpt-goal" });
		marker.style.setProperty("--cpt-goal", options.goal + "%");
		marker.setAttr("aria-hidden", "true");
		if (track.total > 0 && pct >= options.goal) row.addClass("cpt-goal-met");
	}

	row.createSpan({ cls: "cpt-stat", text: stat });

	return row;
}

/** Build one row per placeholder, honoring each one's own options. */
export function buildBarGroup(bars: BarSpec[]): HTMLElement {
	const wrap = createDiv();
	wrap.addClass("cpt-group");
	for (const bar of bars) {
		wrap.appendChild(buildBarRow(bar.count, bar.colorIndex, bar.options));
	}
	return wrap;
}
