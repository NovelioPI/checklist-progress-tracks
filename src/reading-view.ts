import { MarkdownPostProcessorContext, TFile } from "obsidian";
import type ChecklistProgressPlugin from "./main";
import { parseFile, isPlaceholderLine, BarSpec } from "./core";
import { buildBarGroup } from "./render";

/**
 * Reading-view renderer: finds paragraphs made up entirely of placeholder lines
 * ("Label: [!progress_bar]") and replaces them with live bars.
 *
 * Note that consecutive placeholder lines are a *single* markdown paragraph
 * unless strict line breaks are on, so a paragraph is matched line by line
 * against the source rather than by its rendered text. Paragraphs that mix
 * placeholders with prose are left alone, since replacing them would drop the
 * prose's inline formatting.
 *
 * The source markdown is never modified.
 */
export function registerReadingView(plugin: ChecklistProgressPlugin): void {
	plugin.registerMarkdownPostProcessor(async (el, ctx: MarkdownPostProcessorContext) => {
		const candidates = Array.from(el.querySelectorAll("p"));
		if (candidates.length === 0) return;

		// Cheap pre-filter: skip the file read entirely for the vast majority of
		// paragraphs, which contain no placeholder at all.
		const possible = candidates.filter((p) =>
			(p.textContent ?? "").includes("[!progress_bar")
		);
		if (possible.length === 0) return;

		const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;
		const content = await plugin.app.vault.cachedRead(file);
		if (!content) return;

		const lines = content.split("\n");
		const barsByLine = new Map<number, BarSpec>();
		for (const sec of parseFile(content, plugin.settings)) {
			for (const bar of sec.bars) barsByLine.set(bar.line, bar);
		}
		if (barsByLine.size === 0) return;

		for (const p of possible) {
			const info = ctx.getSectionInfo(p);
			if (!info) continue;

			const specs: BarSpec[] = [];
			let allPlaceholders = true;
			for (let i = info.lineStart; i <= info.lineEnd && i < lines.length; i++) {
				const raw = lines[i];
				if (raw.trim() === "") continue;
				if (!isPlaceholderLine(raw)) {
					allPlaceholders = false;
					break;
				}
				const spec = barsByLine.get(i);
				if (spec) specs.push(spec);
			}
			if (!allPlaceholders || specs.length === 0) continue;

			const group = buildBarGroup(specs);
			group.addClass("cpt-reading");
			p.replaceWith(group);
		}
	});
}
