import { App, PluginSettingTab, Setting } from "obsidian";
import type ChecklistProgressPlugin from "./main";
import { TrackConfig } from "./core";

export class ChecklistSettingTab extends PluginSettingTab {
	plugin: ChecklistProgressPlugin;

	constructor(app: App, plugin: ChecklistProgressPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Checklist Progress Tracks" });
		containerEl.createEl("p", {
			text:
				"Works on any note with headings (any level: #, ##, ###, etc.), for any project or " +
				"checklist. Under each heading, add a line like \"Main: [!progress_bar]\" and it will " +
				"render as a live progress bar, computed from the checkboxes under that heading.",
		});

		new Setting(containerEl)
			.setName("Default track label")
			.setDesc(
				"Checkboxes with no recognized #tag count toward this track. Must match a placeholder " +
					"label in your notes exactly (e.g. \"Individu\")."
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.defaultTrackLabel)
					.onChange(async (value) => {
						this.plugin.settings.defaultTrackLabel = value.trim() || "Main";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Skip tag")
			.setDesc(
				"A checkbox line containing #<this tag> is excluded from every track's totals entirely."
			)
			.addText((text) =>
				text.setValue(this.plugin.settings.skipTag).onChange(async (value) => {
					this.plugin.settings.skipTag = (value.trim() || "skip").replace(/^#/, "");
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl("h3", { text: "Custom tracks" });
		containerEl.createEl("p", {
			text:
				"Each row adds a track: a checkbox tagged #<tag> counts toward the track with the matching " +
				"label. The label must match a placeholder line in your note exactly, e.g. " +
				"\"Track B: [!progress_bar]\".",
		});

		this.plugin.settings.tracks.forEach((track, index) => {
			const row = new Setting(containerEl)
				.addText((text) =>
					text
						.setPlaceholder("Label (e.g. Track B)")
						.setValue(track.label)
						.onChange(async (value) => {
							track.label = value;
							await this.plugin.saveSettings();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder("tag (e.g. cp)")
						.setValue(track.tag)
						.onChange(async (value) => {
							track.tag = value.replace(/^#/, "").trim();
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("Remove this track")
						.onClick(async () => {
							this.plugin.settings.tracks.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						})
				);
			row.settingEl.addClass("cpt-track-row");
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("Add track")
				.setCta()
				.onClick(async () => {
					const newTrack: TrackConfig = { label: "New Track", tag: "newtrack" };
					this.plugin.settings.tracks.push(newTrack);
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}
}
