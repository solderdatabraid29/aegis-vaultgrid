# Security Policy

## Supported versions

| Version | Support |
| --- | --- |
| 1.4.x | Full |
| 1.x | Security only |
| pre-1.0 sketches | None — migrate |

VaultGrid stores vault metadata locally. Treat the app-data directory as the
trust boundary: everything inside it is yours, everything outside it should
stay untouched.

## Reporting a vulnerability

Open a private security advisory on this repository. If you cannot use the
form, email the address on the maintainer profile with `VaultGrid` in the
subject — anything else may be sorted into the wrong folder and answered late.

Useful details:

- Build version and platform
- Steps, however rough — a bad repro beats a perfect description
- Whether the vault was imported from a file or typed by hand

## What counts as a security issue here

- Writing outside the app-data directory
- Keeping a Steam Guard secret in swap or a temp file
- Any path where vault metadata is included in a log, export or error message
- Loading state from a file the user did not choose

Feature requests and fee-model disagreements are issues, not advisories.

## Response targets

First reply inside 72 hours. Triage inside a week. Critical fixes ride the
next release; the release notes name the affected path plainly so users of
forks can patch themselves.

## Safe reporting for vault issues

If your report involves a real shared secret, replace the secret with a dummy
that reproduces the behavior. Real secrets in reports are deleted on read and
the report is re-tested with synthesized material.
