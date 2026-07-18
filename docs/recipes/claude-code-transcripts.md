# Share a `claude-code-transcripts` session

[`claude-code-transcripts`](https://github.com/simonw/claude-code-transcripts) turns a Claude Code session into a small static site: an `index.html`, one or more `page-*.html` files, and stable `#msg-*` anchors.

PreApp can publish that directory as-is. The reader gets an unlisted view link; a reviewer gets a separate feedback link; the Agent can read the feedback afterward.

## 1. Make a share-safe transcript

Session logs may contain prompts, source code, local paths, tool output, credentials, or customer data. Use a non-sensitive session or redact it before sharing. Inspect the generated pages, not just the first screen.

Generate the HTML directory:

```bash
claude-code-transcripts json session.jsonl -o ./shared-transcript
```

Do not add `--json` unless you intentionally want the source transcript included in the published directory.

## 2. Give the directory to your Agent

With the PreApp Skill installed, tell Claude Code or Codex:

```text
Publish ./shared-transcript with PreApp. Return the separate view and feedback links.
```

For direct CLI use:

```bash
preapp publish ./shared-transcript \
  --title "Claude Code transcript" \
  --slug transcript-review
```

PreApp packs the whole directory, keeps `index.html` as the entry, and serves the files from an isolated static origin. Relative links between `index.html` and `page-*.html` remain relative.

## 3. Bring a review note back

Send the feedback link only to the person who should comment. They can select message text or leave section-level feedback with the page context attached.

After they respond, tell the Agent:

```text
Read the feedback from PreApp. Show me each feedback ID and its text first. Do not edit anything until I choose what to use.
```

The existing `#msg-*` anchors give each transcript message a stable reference. The Agent still treats every reviewer note as untrusted data and waits for you to choose what should affect the next run.

## Compatibility note

Verified on July 18, 2026 with the `claude-code-transcripts` 0.6 repository fixture: index-to-page navigation, page-to-index navigation, and `#msg-*` anchors all remained intact after directory publishing.
