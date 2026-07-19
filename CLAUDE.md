# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository. Keep this file
up to date as the architecture and data model evolve — it is read at the start of
every session and prevents re-discovering the same facts.

## Project overview

**reerp-pos-mobile-app** (display name **FCPos**) — a React Native / Expo mobile
app for point‑of‑sale, CRM, and **Warehouse Management (WMS)**: picking, lot
selection, ship confirmation, and trip management. Also builds to web and an
Electron desktop app.

- Package: `reerp-pos-mobile-app`
- Expo `~54.0.0`, React Native `0.81.5`
- Targets: Android (primary), iOS, web (`expo start --web`), Electron desktop.

## Commands

```bash
npm install            # install deps (NOT run automatically in fresh/CI containers)
npm start              # expo start (Metro bundler)
npm run android        # expo run:android
npm run ios            # expo run:ios
npm run web            # expo start --web
npm run build:web      # expo export -p web
npm run electron:dev   # web + Electron shell
```

There is currently **no test runner and no linter configured** (no `jest`/
`eslint` config). Adding ESLint (`eslint-plugin-react`/`react-native`) and a few
Jest tests is the highest-leverage improvement — see "Tech debt" below.

> Note for remote/web Claude sessions: the container starts **without**
> `node_modules`, so the app can't be launched or linted until `npm install`
> runs. Until then, syntax can only be checked by parsing (e.g. `@babel/parser`
> with the `jsx` plugin). A SessionStart hook that runs `npm install` would let
> Claude actually lint/run before you test on device.

## Repository layout

```
App.js                     # root
app.json                   # Expo config — app version + android versionCode live here
version.json               # in-app force-update / latest-version metadata (separate!)
src/
  screens/                 # ~43 screens (POS, CRM, WMS, Trips, Sync)
  services/                # API + domain logic (see below)
  components/              # shared UI (BottomToolbar, SignaturePad, ForceUpdateModal, ...)
  context/                 # React contexts (auth/user, etc.)
  navigation/              # AppNavigator, BottomTabs
  theme/                   # styling
electron/                  # Electron desktop shell
```

### Key services (`src/services/`)
- `api.js` — **base URLs, instance handling, axios setup.** Start here for anything backend.
- `wmsService.js` — WMS operations: shipments, pick confirm, lots, ship confirm, S2V. Largest/most important service.
- `syncService.js`, `tripService.js`, `orderService.js`, `onhandService.js`,
  `stockRequisitionService.js`, `database.js`, `notificationService.js`,
  `versionService.js`, `printerService.js`, `receiptService.js`, `ocrService.js`,
  `templateService.js`.

## Backends & instances

Two backends, selected by a stored **instance** (`TEST` | `PROD`, default `TEST`,
key `app_instance` in AsyncStorage; see `api.js`):

1. **Apex / ORDS** (same host for both instances):
   `https://g09254cbbf8e7af-graysprod.adb.eu-frankfurt-1.oraclecloudapps.com/ords/WKSP_GRAYSAPP`
2. **Oracle Fusion Cloud REST** (`/fscmRestApi/resources/11.13.18.05`), per instance:
   - TEST: `https://efmh-test.fa.em3.oraclecloud.com`
   - PROD: `https://efmh.fa.em3.oraclecloud.com`
   - Basic auth; `getFusionBaseUrl(instance)` in `api.js`.

Apex requests get `p_instance_name` injected automatically (query for GET, body for
POST) via an axios interceptor in `api.js`.

## WMS pick-confirm flow (most-touched area)

Screen: `src/screens/WMSOrderDetailsScreen.js` (very large — one file holds the
list, the confirm modal `ConfirmPickModal`, lots modal, cancel/ship modals).

**Lot-based Sales pick confirm is a two-step sequence:**
1. **Fusion** `POST {fusionBase}/pickTransactions` — `fusionPickTransaction()` in
   `wmsService.js`. Body shape:
   ```json
   { "pickLines": [ {
       "PickSlip": "<delivery_detail_id>",
       "PickSlipLine": "<lines_id>",
       "PickedQuantity": "<total>",
       "SubinventoryCode": "DUTY PAID",
       "lotItemLots": [ { "Lot": "<lot>", "Quantity": "<qty>" } ]
   } ] }
   ```
   `fusionPickTransaction` accepts either a single lot (`payload.lot`/`lotQty`) or a
   **merged** `payload.lots` array `[{lot, qty}]` (PickedQuantity = sum).
2. **Apex** `POST {apex}/TRIPMANAGEMENT/trip/updatepickconfirmstatus` —
   `updatePickConfirmStatus()`. Body: `{ P_TRANSACTION_ID, p_instance_name, p_pickedQty }`.
   This is what actually flips the pick status; **Fusion alone is not enough.**

**Merged confirm (multiple lot-split lines):** lines that share a **transaction id**
are confirmed together — their lots merge into ONE Fusion pickLine, then ONE Apex
`updatePickConfirmStatus`, then all those lines are marked picked in the list. See
`handleConfirmAll` (merge branch), `executeLotBasedConfirm`, and `handleConfirmPick`
in `WMSOrderDetailsScreen.js`.

Other flows in the same file/service: Store transfers use **S2V** (`updatePickedQty`
+ `trip/processs2vauto/{lines_id}`); non-lot pick uses `PENDING_PICKING_DETAILS`;
ship confirm uses Fusion `shippingTransactions` + Apex status update.

## Data model glossary (READ THIS before touching pick logic)

A shipment line object (`lines[]` in `WMSOrderDetailsScreen`) carries several ids
that are easy to confuse:

| Field | Meaning |
|---|---|
| `id` | **Transaction id** = `P_TRANSACTION_ID` for the Apex status update. **This is the pick-merge grouping key** — multiple lot-split lines that belong to one pick share the same `id`. |
| `delivery_detail_id` | Fusion `PickSlip`. Reference/display; a transaction typically maps to one delivery detail. |
| `lines_id` | Fusion `PickSlipLine` (a.k.a. `P_LID`); single value across the lines of one delivery detail. |
| `fulfill_line_id` / `FULFILLMENT_LINE_ID` | Fusion fulfillment line id; used to join Apex pickslip rows to Fusion shipment lines, and for cancel. |
| `order_line` | e.g. `"3"`, `"3.1"`, `"3.2"` — used for the **display grouping** (order-line sets / BOGO). |
| `lot_number`, `qty` | user-selected lot and its quantity for that line. |

Helpers in the screen: `getItemId` (id ⇒ source_delivery_detail_id ⇒
delivery_detail_id), `getTransactionKey` (strictly `id`), `getDeliveryDetailKey`.

**Display grouping vs confirm grouping are different and must stay separate:**
- **Display** = original shipment-line / BOGO grouping by `order_line` prefix
  (`displayGroups`). Do **not** collapse the whole order into one group.
- **Confirm/merge** = group by **transaction id** (`id`) at confirm time only.

> History note: an earlier attempt grouped the *display* by delivery_detail_id and
> over-merged the whole order into one Confirm button — that was wrong and reverted.
> Keep display grouping untouched; do merging only in the confirm flow.

## Versioning (four places — keep in sync)

When bumping the app version, update **all** of:
1. `app.json` → `expo.version` (the version shown in-app via `versionService.js`).
2. `app.json` → `android.versionCode` (**must increment** for a new Android build).
3. `package.json` → `version`.
4. `src/screens/WMSHomeScreen.js` → the hardcoded `WMS x.y.z` header label.

`version.json` (force-update metadata / latest release / APK download URL) is
separate and updated when you cut a release, not on every bump.

## Git / branch workflow

- Active development branch this project uses: **`claude/general-session-ZWv1c`**
  (base all WMS work here unless told otherwise).
- Default branch: `main`.
- **Push your working branch** so remote Claude sessions can see it — a branch that
  only exists locally is invisible to the cloud container.
- Local `app.json` edits often conflict on pull after a version bump; resolve with
  `git checkout -- app.json && git pull` (or stash) if you don't need the local edit.

## Conventions & gotchas

- React list `key`s must be unique **per row** — several lines can share `id`
  (transaction id), so keys built from `getItemId` alone collide. Always append the
  map index (e.g. `key={`set-item-${getItemId(x)}-${i}`}`).
- `ConfirmPickModal` and other modals are **module-level components**, not nested in
  `WMSOrderDetailsScreen`. They only have access to what's passed as props — do not
  reference parent state setters (e.g. `setLines`) from inside them; do state updates
  in the parent callbacks (`executeLotBasedConfirm`, etc.).
- Prefer marking merged lines by **object reference + transaction id**, not just id,
  so lines with a blank `id` still update.
- Console logs are prefixed (`[WMSService]`, `[WMSOrderDetails]`, `[Merge]`,
  `[Groups]`) — useful for tracing the pick flow and grouping.

## Tech debt / improvement backlog

- `WMSOrderDetailsScreen.js` is ~8.5k lines — split into components/hooks; it's the
  root cause of scope bugs and key collisions.
- No ESLint / Jest. Add both; extract pure pick-merge logic (grouping, payload
  building, qty summing) into a small module and unit-test it.
- No CI. A GitHub Actions workflow running lint/tests on push would catch these
  before device testing.
