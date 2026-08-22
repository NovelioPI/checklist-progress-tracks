import { MarkdownPostProcessorContext, TFile } from "obsidian";
import type ChecklistProgressPlugin from "./main";
import { parseFile, isPlaceholderLine, SectionProgress } from "./core";
import { buildBarRow } from "./render";

/**
 * Reading-view renderer: finds paragraphs whose whole text is a placeholder
 * line ("Label: [!progress_bar]") and replaces them with a live bar.
 * The source markdown is never modified.
 */
export function registerReadingView(plugin: ChecklistProgressPlugin): void {
	plugin.registerMarkdownPostProcessor(async (el, ctx: MarkdownPostProcessorContext) => {
		const candidates = Array.from(el.querySelectorAll("p"));
		if (candidates.length === 0) return;

		let fileContentPromise: Promise<string> | null = null;
		const getContent = (): Promise<string> => {
			if (!fileContentPromise) {
				const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
				fileContentPromise =
					file instanceof TFile ? plugin.app.vault.cachedRead(file) : Promise.resolve("");
			}
			return fileContentPromise;
		};

		for (const p of candidates) {
			const text = (p.textContent ?? "").trim();
			const ph = isPlaceholderLine(text);
			if (!ph) continue;

			const info = ctx.getSectionInfo(p);
			if (!info) continue;

			const content = await getContent();
			if (!content) continue;

			const sections = parseFile(content, plugin.settings);
			// The section this placeholder belongs to is the closest section
			// header at or before this line.
			let sec: SectionProgress | null = null;
			for (const s of sections) {
				if (s.line <= info.lineStart) sec = s;
			}
			if (!sec) continue;

			const idx = sec.tracks.findIndex((t) => t.label === ph.label);
			if (idx === -1) continue;

			const bar = buildBarRow(sec.tracks[idx], idx);
			bar.addClass("cpt-reading");
			p.replaceWith(bar);
		}
	});
}
