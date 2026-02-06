# @bax/display-rules

Display rules for Stage 0.1 Radiography outputs. These rules ensure that
publish-blockers are never shown unless they are verified.

## Exports
- `DISPLAY_RULES_V0_VERSION`
- `shouldShowField(fieldPath, fieldStatus)`
- `SafeCopyIdEnum`, `getSafeCopy(id, locale)`
- `INSTAGRAM_ALLOWLIST_V0`

## Policy
- Publish-blocker fields are only visible when `fieldStatus === "verified"`.
- Instagram input is limited to identity/tone cues (no operational facts).
