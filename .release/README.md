# Releases via mint

This package releases through [`@bounded-systems/mint`](https://github.com/bounded-systems/mint)
— deterministic versioning, intent files in, signed release out.

Each PR that should ship drops an intent file here:

```markdown
---
bump: minor   # major | minor | patch
---
one-line summary of the change (becomes the changelog entry)
```

To cut a release (once intents have accumulated):

```sh
mint plan       # preview the version bump + changelog
mint version    # bump deno.json + prepend CHANGELOG.md + consume intents
mint release    # cut the v<version> tag → publish-jsr.yml publishes to JSR
```

mint reads the version from `deno.json` (bounded-systems/mint#13).
