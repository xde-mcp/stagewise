---
"@stagewise/extension-toolbar-srpc-contract": minor
"@stagewise/plugin-example": minor
"@stagewise-plugins/angular": minor
"@stagewise-plugins/react": minor
"@stagewise/toolbar": minor
"@stagewise-plugins/vue": minor
"@stagewise/plugin-builder": patch
---

Revamp toolbar loading mechanism to use iframes

- Plugins must now be default exported
- Plugins must use the @stagewise/plugin-builder package to build their plugin
- Deployed plugins are now default exports. Make sure to update your project accordingly.