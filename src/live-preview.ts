import { EditorState, Extension, RangeSetBuilder, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import type ChecklistProgressPlugin from "./main";
import { BarSpec, parseFile } from "./core";
import { buildBarRow } from "./render";

class ProgressBarWidget extends WidgetType {
	constructor(private spec: BarSpec, private raw: string) {
		super();
	}

	eq(other: ProgressBarWidget): boolean {
		// The raw line determines the label and every option, so counts are all
		// that still need comparing.
		return (
			other.raw === this.raw &&
			other.spec.count.checked === this.spec.count.checked &&
			other.spec.count.total === this.spec.count.total &&
			other.spec.colorIndex === this.spec.colorIndex
		);
	}

	toDOM(): HTMLElement {
		const el = buildBarRow(this.spec.count, this.spec.colorIndex, this.spec.options);
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
		if (!fullText.includes("[!progress_bar")) return Decoration.none;

		const barsByLine = new Map<number, BarSpec>();
		for (const sec of parseFile(fullText, plugin.settings)) {
			for (const bar of sec.bars) barsByLine.set(bar.line, bar);
		}
		if (barsByLine.size === 0) return Decoration.none;

		const cursorLine = doc.lineAt(state.selection.main.head).number; // 1-based

		const builder = new RangeSetBuilder<Decoration>();
		for (const lineIndex of Array.from(barsByLine.keys()).sort((a, b) => a - b)) {
			const lineNumber = lineIndex + 1; // barsByLine keys are 0-based
			if (lineNumber === cursorLine) continue; // let the user edit the raw line
			if (lineNumber > doc.lines) continue;

			const line = doc.line(lineNumber);
			const spec = barsByLine.get(lineIndex);
			if (!spec) continue;

			const widget = new ProgressBarWidget(spec, line.text);
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
