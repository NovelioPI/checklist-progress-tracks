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

## Bar options

A placeholder can take a space-separated argument list:

```
Main: [!progress_bar rollup goal=80 color=green format=count]
```

| Option | Values | What it does |
| --- | --- | --- |
| `rollup` | flag (or `rollup=false`) | Count checkboxes in nested subsections too, not just this heading's own body. |
| `track` | a track label | Count this track while displaying the placeholder's own label — so a bar can read `Total:` but count the `Main` track. |
| `goal` | `0`–`100` (a trailing `%` is fine) | Draws a target marker on the bar; the readout turns green once you reach it. |
| `color` | `red` `orange` `yellow` `green` `cyan` `blue` `purple` `pink` `accent`, or any CSS color | Overrides this track's default color. |
| `format` | `both` (default), `percent`, `count`, `remaining` | Wording of the readout: `63% (12/19)`, `63%`, `12/19`, or `7 left`. |

Unknown options are ignored, so a typo falls back to a plain bar rather than
making the placeholder vanish.

### Rollup

By default a heading counts only the checkboxes between it and the *next
heading of any level*, so a checkbox always belongs to the single nearest
heading above it. `rollup` extends the range through nested subsections, up to
the next heading of equal or higher rank:

```
## Release

Total: [!progress_bar rollup track=Main]    ← 50% (3/6), everything below

### Backend

Backend: [!progress_bar track=Main]         ← 67% (2/3), just this subsection

- [x] Schema
- [x] Migrations
- [ ] Workers

### Frontend

Frontend: [!progress_bar track=Main]        ← 33% (1/3), just this subsection

- [x] Routing
- [ ] Settings page
- [ ] Empty states
```

A placeholder's label normally *is* the track name, which is why the three bars
above use `track=Main` to count the default track while showing a heading-specific
label. If you're happy for every bar to read `Main:`, you can drop `track=`
entirely.

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
