# Evidence provenance correction

The 11 November 2026 regression initially reused this runner's hard-coded
9 November output path/date and regenerated its en/lv/ru evidence/screenshots.
Those generated files must be treated as an 11 November rerun, not original
9 November raw evidence. The original prose report remains in
`docs/frontend-provider-navigation-2026-11-09.md`. The runner now writes separately
dated 11 November evidence to `output/frontend-provider-navigation-2026-11-11/`.
Deferred-language historical evidence elsewhere was not executed or changed.
