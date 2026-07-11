---
name: add-new-architecture-or-domain-doc
description: Workflow command scaffold for add-new-architecture-or-domain-doc in myUNO-final.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-new-architecture-or-domain-doc

Use this workflow when working on **add-new-architecture-or-domain-doc** in `myUNO-final`.

## Goal

Adds a new documentation file describing a specific architecture decision, domain model, or major system area.

## Common Files

- `docs/NN_<topic>.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create a new markdown file in docs/ with a sequential number and descriptive name (e.g., docs/01_architecture_decisions.md).
- Write detailed documentation for the topic.
- Commit the new file with a message starting with 'docs NN: <topic>'

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.