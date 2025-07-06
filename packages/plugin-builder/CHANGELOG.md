# @stagewise/plugin-builder

## 0.5.0

### Patch Changes

- e4a0864: Revamp toolbar loading mechanism to use iframes

  - Plugins must now be default exported
  - Plugins must use the @stagewise/plugin-builder package to build their plugin
  - Deployed plugins are now default exports. Make sure to update your project accordingly.

- Updated dependencies [e4a0864]
  - @stagewise/toolbar@0.5.0
