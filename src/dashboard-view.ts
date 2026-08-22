import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer } from "obsidian";
import type ChecklistProgressPlugin from "./main";
import { parseFile, FileProgress } from "./core";
import { buildBarGroup } from "./render";

export const CHECKLIST_DASHBOARD_VIEW_TYPE = "checklist-progress-tracks-dashboard";

export class ChecklistDashboardView extends ItemView {
	plugin: ChecklistProgressPlugin;
	private refreshHandle: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ChecklistProgressPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return CHECKLIST_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Checklist progress dashboard";
	}

	getIcon(): string {
		return "gauge";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
		this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRefresh()));
	}

	async onClose(): Promise<void> {
		if (this.refreshHandle !== null) window.clearTimeout(this.refreshHandle);
	}

	private scheduleRefresh(): void {
		if (this.refreshHandle !== null) window.clearTimeout(this.refreshHandle);
		this.refreshHandle = window.setTimeout(() => this.refresh(), 300);
	}

	private async collectVaultProgress(): Promise<FileProgress[]> {
		const files = this.app.vault.getMarkdownFiles();
		const out: FileProgress[] = [];
		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			if (!content.includes("[!progress_bar]")) continue;
			const sections = parseFile(content, this.plugin.settings);
			if (sections.some((s) => s.tracks.length > 0)) {
				out.push({ path: file.path, sections });
			}
		}
		return out;
	}

	async refresh(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("cpt-dashboard-container");

		const header = container.createDiv({ cls: "cpt-dashboard-header" });
		header.createEl("h3", { text: "Checklist progress dashboard" });
		const refreshBtn = header.createEl("button", { text: "Refresh" });
		refreshBtn.addEventListener("click", () => this.refresh());

		const data = await this.collectVaultProgress();

		if (data.length === 0) {
			container.createEl("p", {
				text:
					'No notes found with headings and a "[!progress_bar]" placeholder yet.',
				cls: "cpt-dashboard-empty",
			});
			return;
		}

		for (const fp of data) {
			const fileBlock = container.createDiv({ cls: "cpt-dashboard-file" });
			const titleEl = fileBlock.createEl("h4", { cls: "cpt-dashboard-file-title" });
			const link = titleEl.createEl("a", { text: fp.path.replace(/\.md$/, "") });
			link.addEventListener("click", (evt) => {
				evt.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(fp.path);
				if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
			});

			for (const sec of fp.sections) {
				if (sec.tracks.length === 0) continue;
				const secBlock = fileBlock.createDiv({ cls: "cpt-dashboard-section" });
				secBlock.createEl("div", { cls: "cpt-dashboard-section-name", text: sec.name });
				secBlock.appendChild(buildBarGroup(sec.tracks));
			}
		}
	}
}
