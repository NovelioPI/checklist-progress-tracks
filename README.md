# Checklist Progress Tracks

Turns tagged checkboxes under any heading into live, multi-track progress bars — for any project or checklist, not tied to one note or one use case.

## How it works

1. Under any heading (`#`, `##`, `###`, etc.), add a line for each track you want to show, using the label you want displayed:

   ```
   ## Section name

   Main: [!progress_bar]
   Partner: [!progress_bar]

   - [x] Something done
   - [ ] Something not done yet #partner
   - [x] Something excluded from every track #skip
   ```

2. Each checkbox under that heading counts toward a track:
   - No tag → the **default track** (configurable, e.g. "Main").
   - `#<tag>` → whatever track you've mapped that tag to in settings (e.g. `#partner` → "Partner").
   - `#skip` (configurable) → excluded from every track's totals.

3. The `Label: [!progress_bar]` line renders as a live bar in Reading view and Live Preview — the note's raw text is never rewritten, so there's nothing to get out of sync.

## Dashboard

Open the gauge icon in the ribbon, or run "Open checklist progress dashboard" from the command palette, to see every tracked heading across your whole vault in one place, refreshing live as you check things off.

## Settings

- **Default track label** — which track untagged checkboxes count toward.
- **Skip tag** — the tag that excludes a checkbox entirely.
- **Custom tracks** — add as many label/tag pairs as you need; each corresponds to its own `Label: [!progress_bar]` line.

## Installing manually (until this is in the community directory)

1. Download `main.js`, `manifest.json`, and `styles.css` from a release.
2. Create a folder named after the plugin id inside your vault: `<vault>/.obsidian/plugins/checklist-progress-tracks/`.
3. Put the three files in that folder.
4. Reload Obsidian (or toggle the plugin off/on) and enable it in Settings → Community plugins.

## License

MIT — see [LICENSE](./LICENSE).
