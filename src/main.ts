import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, ChecklistProgressSettings } from "./core";
import { ChecklistSettingTab } from "./settings";
import { registerReadingView } from "./reading-view";
import { buildLivePreviewExtension } from "./live-preview";
import { ChecklistDashboardView, CHECKLIST_DASHBOARD_VIEW_TYPE } from "./dashboard-view";

export default class ChecklistProgressPlugin extends Plugin {
	settings!: ChecklistProgressSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		registerReadingView(this);
		this.registerEditorExtension(buildLivePreviewExtension(this));

		this.registerView(
			CHECKLIST_DASHBOARD_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new ChecklistDashboardView(leaf, this)
		);

		this.addRibbonIcon("gauge", "Open checklist progress dashboard", () => {
			this.activateDashboard();
		});

		this.addCommand({
			id: "open-checklist-progress-dashboard",
			name: "Open checklist progress dashboard",
			callback: () => this.activateDashboard(),
		});

		this.addSettingTab(new ChecklistSettingTab(this.app, this));
	}

	onunload(): void {
		// Editor extension and markdown post-processor are cleaned up automatically
		// by Obsidian's register* helpers.
	}

	async activateDashboard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(CHECKLIST_DASHBOARD_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: CHECKLIST_DASHBOARD_VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		// Deep-clone the default tracks array so multiple vaults don't share references.
		if (!loaded || !loaded.tracks) {
			this.settings.tracks = DEFAULT_SETTINGS.tracks.map((t) => ({ ...t }));
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
