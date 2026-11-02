# AWS Agent Toolkit setup — 30 October 2026

Status: installation/configuration and live AWS MCP connection verified on
31 October. Open a new Codex conversation to load the configured tools into its
tool catalog. Executor: `/root`, following the user's direct setup request
and the [AWS setup instructions](https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md).

## Authorized scope and choices

- Windows local setup for Codex; AWS experience: new AWS experience.
- User-selected AWS CLI profile: `fitsmytime`.
- Project Region: `eu-north-1`. The toolkit service uses `us-east-1` as required
  by the upstream guide; this does not change the project Region.
- The user explicitly approved installing the missing AWS CLI and `uv` and
  continuing setup. Authentication must use the user's browser; do not collect
  access keys, passwords or sign-in tokens in this document.
- Scope includes toolkit installation, its MCP profile configuration, verification
  and an idempotent addition of the AWS experience guidance to project rules.
  Existing project rules take precedence. Preserve unrelated work and existing
  MCP servers. Deployment holds remain in force.
- The user subsequently selected **Codex only** for use of `fitsmytime` through
  MCP. This is the final access scope; do not enable that profile in other tools
  based on the installer's automatic detection.

## Progress and checks

- Identified Windows and PowerShell 7.6.9.
- Neither `aws` nor `uv` was found on PATH at the initial check.
- Found Codex in the VS Code extension and its user `config.toml`; no existing
  AWS MCP entry was found in the checked Codex/project configuration locations.
- Restricted-shell DNS failed for `awscli.amazonaws.com`. The connectivity check
  outside the sandbox succeeded with HTTP 200.
- Downloaded and inspected the official AWS CLI and `uv` PowerShell installers.
  Ran both using their per-user defaults. AWS MSI Authenticode signature
  verification succeeded without disabling verification.
- Verified `uv 0.13.6` and `aws-cli/2.39.2`. AWS CLI is installed under
  `%LOCALAPPDATA%/Programs/Amazon/AWSCLIV2`; `uv` is under `%USERPROFILE%/.local/bin`.
- Configured `fitsmytime` with Region `eu-north-1`. Browser login completed
  successfully (exit 0). `aws sts get-caller-identity --profile fitsmytime
  --region eu-north-1` succeeded; the returned project identity matched the user's
  console. `aws configure get region --profile fitsmytime` returned `eu-north-1`.
- Backed up existing Codex, Claude and VS Code MCP configuration files under the
  user's temporary `fitsmytime-aws-toolkit-setup` directory before installation.
- `aws configure agent-toolkit --yes --region us-east-1 --profile fitsmytime`
  completed successfully (exit 0). It installed 24 default skills and generated
  AWS MCP entries for Codex, Claude Code, Cline and Cursor.
- Automatic approval review rejected the first attempted multi-tool profile
  binding before execution, because that broader authenticated access scope was
  not explicit. The user then selected Codex only. Added
  `AWS_MCP_PROXY_PROFILES = "fitsmytime"` under `[mcp_servers.aws-mcp.env]` in the
  user's Codex `config.toml`; preserved the installer's command and arguments.
  `codex mcp get aws-mcp --json` parsed the configuration successfully and reported
  the AWS connection enabled with the correct profile.
- Removed only the generated `aws-mcp` entries from the user's `.claude.json`,
  `.cline/mcp.json` and `.cursor/mcp.json` in accordance with the Codex-only choice.
  Backed up each file first, validated JSON round-trip preservation of remaining
  settings, and checked for concurrent changes before writing. Installed skill
  files in those tools remain; these do not grant AWS access.
- The first catalog command failed on Windows output encoding:
  `'charmap' codec can't encode character '\u2192' in position 878: character maps to <undefined>`.
  Retried with process-local `AWS_CLI_OUTPUT_ENCODING=UTF-8`, following the
  [documented AWS encoding setting](https://docs.aws.amazon.com/cli/latest/topic/config-vars.html).
  `aws agent-toolkit list-available-skills --region us-east-1 --profile fitsmytime
  --output json` then succeeded and returned valid JSON containing 118 skills.
  No system-wide encoding setting was changed.
- Verified all 24 expected Codex skill directories contain `SKILL.md` under
  `%USERPROFILE%/.agents/skills/`.
- Added the upstream new-experience guidance in one marked block in
  [AGENTS.md](../AGENTS.md), including the Region, profile and Codex-only scope.
  Verified the entire pre-existing file remained the unchanged prefix, the
  complete downloaded guidance was included, and each marker occurs once.
  Source SHA256: `EABDAC60B6E957E8F6B6539848CD5009946B2BE1DF9C81E3D277CFD041D3671B`.
  `git diff --check -- AGENTS.md docs/aws-agent-toolkit-setup.md` passed.
- Current-session MCP tool discovery/live handshake was not exercised; the
  restarted Codex session will load that connection. AWS login, CLI access,
  remote toolkit catalog and local configuration/skill/rule checks passed.

## Validation and recovery

Required evidence: prerequisite versions, successful browser login, STS identity
verification, toolkit wizard completion, catalog listing, generated MCP entry
using `AWS_MCP_PROXY_PROFILES=fitsmytime`, and preserved project instructions with
one marked AWS rules block. Do not include credentials or private configuration
contents in evidence.

Recovery: preserve configuration backups before changing existing user files;
remove only setup-created entries/rules if reverting. Do not revert other agents'
work. No application tests are needed for this setup. Language checks were not
run; en/lv/ru remain the accepted testing scope and ar/RTL, zh, fr, de, hi, ja, pt
and es remain deferred.

Backups and downloaded verification inputs are under
`%LOCALAPPDATA%/Temp/fitsmytime-aws-toolkit-setup/`. Preserve them for recovery;
do not commit private user configuration backups. Remove only the delimited AWS
block when reverting the repository instructions. Application code, `.env`,
database state and deployment resources were not changed by this setup.

To use another AWS project later, run `aws login --profile <name>`, add that name
to the space-separated `AWS_MCP_PROXY_PROFILES` list in Codex's configuration,
and restart Codex. Enabling access for another AI tool needs the user's selection.

## Post-restart verification — 31 October 2026

The user restarted VS Code. The AWS skill catalog is now present in the session's
available-skills inventory. `codex mcp get aws-mcp --json` still reports the
connection enabled with `AWS_MCP_PROXY_PROFILES=fitsmytime`; this existing
conversation does not expose AWS MCP tools directly.

Verified the installed AWS CLI binary is version 2.39.2 and the profile Region is
still `eu-north-1`. The existing host shell did not resolve `aws` by name, but the
saved user PATH already includes its correct installation directory. No PATH or
registry setting was changed. An initial registry lookup used unsupported forward
slashes and failed; the corrected read confirmed the saved PATH entry.

Launched `uvx mcp-proxy-for-aws@latest --help`, which populated the proxy's runtime
dependency cache and successfully displayed MCP Proxy for AWS v1.7.0 help.
Then tested the configured stdio connection using MCP initialize/tools-list only,
with the exact configured endpoint/arguments and `fitsmytime` profile. Startup
failed because AWS's `CreateOAuth2Token` returned **The refresh token has expired**;
the downstream MCP error was `Invalid request parameters`. This is a credential
renewal failure, not evidence of successful live MCP access.

The local CLI independently confirmed **Your session has expired. Please
reauthenticate using 'aws login'.** Restarted the same authorized browser flow:
`aws login --profile fitsmytime --region eu-north-1`. At the user's request,
reopened the same pending browser authorization page after they closed it. The
user selected Fresh Deploy and reported AWS's credentials-shared success message.
The login command then exited successfully, and its subsequent STS identity check
passed for the same project/role as the original setup. Do not copy temporary
authorization URLs, tokens or callback parameters here.

Repeated the live MCP check with the exact configured endpoint/arguments and
`AWS_MCP_PROXY_PROFILES=fitsmytime`: initialize passed and tools/list returned
**8 tools**, including `aws___search_documentation` and `aws___retrieve_skill`.
Both checks used an ephemeral stdio client and exited successfully; no persistent
extra MCP client was left running.

Verified a real read-only request through that MCP connection:
`aws___search_documentation`, topic `agent_skills`, returned `signing-in-to-aws`.
Retrieved that exact skill with `aws___retrieve_skill` and read its full content;
both requests succeeded. These checks establish live MCP connectivity, rather
than configuration alone. The existing chat still has no direct AWS MCP tools
in its model tool catalog; a new Codex conversation is the next client step.

No deployment, database operation, new permissions, additional AI-tool access or
application tests were performed. Existing deployment holds remain in effect.
