# AGENTS.md — myUNO implementation entry point

All coding agents must follow the vendor-neutral canonical specification in this repository.

Read in order:
1. `PROJECT.md`
2. `docs/canonical/README.md`
3. the documents listed there.

Do not treat tool-specific instruction files as higher authority than the canonical pack.

Mandatory workflow:
`inspect current HEAD/open PRs → reconcile → implement vertical slice → migrate safely → test → deploy → runtime verify → update docs/evidence`.

Do not declare completion from code existence or a green build alone.
