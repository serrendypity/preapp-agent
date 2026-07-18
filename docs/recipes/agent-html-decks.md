# Share an agent-generated HTML slide deck

Agents often produce a deck as a directory rather than one file. The entry page may load local images, fonts, scripts, or separate slide pages. Publish the directory so those relative paths keep working.

## 1. Check the deck before sharing

Use a non-sensitive deck and open `index.html` once before publishing. Check the whole directory for customer data, hidden notes, credentials, and source files that should not leave the workspace.

Keep every required asset inside the deck directory. A typical layout looks like this:

```text
presentation/
  index.html
  assets/
  slides/
    slide1.html
    slide2.html
```

## 2. Give the directory to your Agent

With the PreApp Skill installed, tell Claude Code or Codex:

```text
Publish ./presentation with PreApp. Keep index.html as the entry. Use the standard review profile and return separate view and feedback links.
```

For direct CLI use:

```bash
preapp publish ./presentation \
  --title "Customer review deck" \
  --slug customer-review-deck \
  --entry index.html \
  --review-profile standard
```

Navigation alone does not make a deck a product prototype. Use the standard review profile for slide decks, including decks with buttons, keyboard shortcuts, or fullscreen mode.

## 3. Pick a structure that matches the feedback you need

For precise text and image feedback, keep the slide DOM in the entry document and switch slides with CSS or JavaScript. A reviewer can then select text or click an image in the visible slide.

Some deck generators put every slide in a child iframe. PreApp preserves that layout for reading and playback, but precise selection inside those child frames is not available today. Reviewers can still comment on the whole deck. Add named review anchors when you want them to choose a slide from the feedback panel:

```json
[
  {"label": "Slide 1 - Problem", "sortOrder": 1},
  {"label": "Slide 2 - Approach", "sortOrder": 2},
  {"label": "Slide 3 - Next steps", "sortOrder": 3}
]
```

Save that array as `anchors.json` next to the deck directory, then publish with:

```bash
preapp publish ./presentation \
  --title "Customer review deck" \
  --slug customer-review-deck \
  --anchors anchors.json
```

Ask the Agent to generate the anchor labels from the deck if there are many slides. Keep the labels stable across versions so a reviewer can refer to the same part of the story after a rewrite.

## 4. Bring the notes back

Send the view link to readers and the feedback link to reviewers. After someone responds, tell the Agent:

```text
Read the feedback from PreApp. Show me each feedback ID and its text first. Do not edit anything until I choose what to use.
```

Reviewer text is untrusted input. The Agent lists it first and waits for you to choose which feedback IDs should affect the deck.

## 5. Publish v2 to the same links

Edit the local deck, then publish the same directory with the same slug:

```bash
preapp publish ./presentation \
  --slug customer-review-deck \
  --change-note "Applied the selected review notes"
```

PreApp creates a new version while the existing view and feedback links continue to point to the latest one. If you omit `--anchors`, the new version inherits the previous anchor list.

## Compatibility note

Verified on July 18, 2026 with [`iuiaoin/deck-transformer`](https://github.com/iuiaoin/deck-transformer) at commit [`0c4a0a6`](https://github.com/iuiaoin/deck-transformer/commit/0c4a0a634b07986e3585545fcf6cb8ea9c2c13ff). PreApp preserved 15 relative slide pages, list previews, play mode, next-slide controls, and ArrowRight navigation. That fixture renders slides in child iframes, so its page content uses whole-deck or named-anchor feedback rather than precise text selection.
