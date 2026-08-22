import { EditorState, Extension, RangeSetBuilder, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import type ChecklistProgressPlugin from "./main";
import { isPlaceholderLine, parseFile, SectionProgress, TrackCount } from "./core";
import { buildBarRow } from "./render";

class ProgressBarWidget extends WidgetType {
	constructor(private track: TrackCount, private colorIndex: number, private raw: string) {
		super();
	}

	eq(other: ProgressBarWidget): boolean {
		return (
			other.raw === this.raw &&
			other.track.checked === this.track.checked &&
			other.track.total === this.track.total &&
			other.track.label === this.track.label
		);
	}

	toDOM(): HTMLElement {
		const el = buildBarRow(this.track, this.colorIndex);
		el.addClass("cpt-live-preview");
		return el;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Builds a CM6 StateField that decorates placeholder lines with a live
 * progress bar widget, but only when the cursor is not on that line (so
 * clicking into the line reveals the raw "[!progress_bar]" text to
 * edit, standard Obsidian live-preview behavior) and only in Live Preview
 * mode (not raw source mode).
 */
export function buildLivePreviewExtension(plugin: ChecklistProgressPlugin): Extension {
	function computeDecorations(state: EditorState): DecorationSet {
		const isLivePreview = state.field(editorLivePreviewField, false);
		if (isLivePreview === false) return Decoration.none;

		const doc = state.doc;
		const fullText = doc.toString();
		const sections = parseFile(fullText, plugin.settings);
		const selection = state.selection.main;
		const cursorLine = doc.lineAt(selection.head).number; // 1-based

		const builder = new RangeSetBuilder<Decoration>();
		for (let i = 1; i <= doc.lines; i++) {
			const line = doc.line(i);
			const ph = isPlaceholderLine(line.text);
			if (!ph) continue;
			if (i === cursorLine) continue; // let the user edit the raw line while their cursor is there

			// Find the enclosing section (last section header at/before this line).
			let sec: SectionProgress | null = null;
			for (const s of sections) {
				if (s.line <= i - 1) sec = s; // s.line is 0-based
			}
			if (!sec) continue;
			const idx = sec.tracks.findIndex((t) => t.label === ph.label);
			if (idx === -1) continue;

			const widget = new ProgressBarWidget(sec.tracks[idx], idx, line.text);
			builder.add(line.from, line.to, Decoration.replace({ widget, block: false }));
		}
		return builder.finish();
	}

	return StateField.define<DecorationSet>({
		create(state) {
			return computeDecorations(state);
		},
		update(deco, tr: Transaction) {
			// Recompute on every transaction: cheap for note-sized documents,
			// and needed because both doc edits and cursor moves (to reveal /
			// hide the raw placeholder line) must update the rendered bars.
			return computeDecorations(tr.state);
		},
		provide: (field) => EditorView.decorations.from(field),
	});
}
