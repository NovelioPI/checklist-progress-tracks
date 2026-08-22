import { TrackCount, percentOf } from "./core";

/** Deterministic-ish color per track index, using theme-aware CSS vars where possible. */
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

/** Build a single "<Label> [bar] 63% (12/19)" row as a DOM element. */
export function buildBarRow(track: TrackCount, colorIndex: number): HTMLElement {
	const row = document.createElement("div");
	row.addClass("cpt-row");

	const label = row.createSpan({ cls: "cpt-label", text: track.label + ":" });
	label.style.color = colorForTrackIndex(colorIndex);

	const track_el = row.createDiv({ cls: "cpt-track" });
	const fill = track_el.createDiv({ cls: "cpt-fill" });
	const pct = track.total === 0 ? 0 : percentOf(track.checked, track.total);
	fill.style.width = pct + "%";
	fill.style.background = colorForTrackIndex(colorIndex);

	const stat = row.createSpan({ cls: "cpt-stat" });
	stat.setText(
		track.total === 0 ? "n/a" : `${pct}% (${track.checked}/${track.total})`
	);

	return row;
}

export function buildBarGroup(tracks: TrackCount[]): HTMLElement {
	const wrap = document.createElement("div");
	wrap.addClass("cpt-group");
	tracks.forEach((t, i) => wrap.appendChild(buildBarRow(t, i)));
	return wrap;
}
