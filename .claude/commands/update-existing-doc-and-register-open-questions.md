---
name: update-existing-doc-and-register-open-questions
description: Workflow command scaffold for update-existing-doc-and-register-open-questions in myUNO-final.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-existing-doc-and-register-open-questions

Use this workflow when working on **update-existing-doc-and-register-open-questions** in `myUNO-final`.

## Goal

Updates an existing documentation file and appends or modifies the open questions register.

## Common Files

- `docs/NN_<topic>.md`
- `docs/open_questions.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit an existing docs/NN_<topic>.md file.
- Edit docs/open_questions.md to add or update open questions related to the topic.
- Commit both files together with a message referencing the topic and open questions.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.