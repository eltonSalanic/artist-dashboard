# This is NOT the React Native you know

Expo and React Native move fast and have breaking changes versus training data —
APIs, config format, and file conventions all differ. **Use the installed skills
in `.claude/skills/` before writing code**; they are version-pinned to the
releases this app targets and override stale recall.

Start with `expo-overview`, then the skill for the area you are touching:

| Area | Skill |
|---|---|
| Routing, navigation, deep links | `expo-router` |
| Monorepo layout, Metro config | `expo-project-structure` |
| Porting web code to native | `expo-web-to-native` |
| API calls, React Query, caching | `expo-data-fetching` |
| Theme tokens, component structure | `expo-design-system` |
| HIG styling, safe areas, native feel | `expo-native-ui` |
| Animation, gestures | `expo-animation`, `animate-expo` |
| Dev builds on device | `expo-dev-client`, `eas-simulator` |
| Builds, OTA updates, store submission | `eas-app-stores`, `eas-update`, `eas-workflows` |
| Upgrading Expo / RN | `expo-upgrade`, `upgrading-react-native` |
| React performance | `vercel-react-native-skills` |

## App-specific rules

- **Styling is React Native `StyleSheet`.** NativeWind/Tailwind was considered
  and declined — do not introduce it. Tokens come from
  `@artist/shared` (`theme.ts`, `resolveBoardTheme`), the same source the web
  app uses, so board palettes match across platforms.
- **No webviews.** `use-dom`/`expo-dom` are deliberately not installed; Expo
  was chosen over a Capacitor wrapper precisely to avoid a webview.
- **Data goes through `packages/api-client`** — never call the API directly and
  never duplicate a query hook that already lives there.
- **Permissions come from the shared `can()` map** in
  `packages/shared/src/permissions.ts`. Never hardcode a role check.
- **No skill covers push notifications or `expo-secure-store`.** Work from
  Expo's own docs there and verify on a physical device.

Plan and phase tracker: [`docs/mobile-app.md`](../../docs/mobile-app.md).
