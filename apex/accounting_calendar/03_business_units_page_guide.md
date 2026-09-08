# Manage Business Units — "Create Calendar" button (APEX page changes)

Goal: each business unit row gets a **Create Calendar** button. If the BU's
ledger already has rows in `RR_ACCOUNTING_PERIODS_STATUS`, the button is
disabled and shows **Calendar Exists**. The button opens a modal that asks for
calendar type (Fiscal / Calendar) and the first period, then creates all
periods via `RR_CALENDAR_PKG` (script `01`). ORDS endpoints from script `02`
are for external/mobile callers; the APEX page calls the package directly.

## 1. Report region SQL (Manage Business Units page)

Add a calendar-exists flag to the business units query (adjust the BU table /
ledger column names to yours):

```sql
select bu.*,
       case when exists (select 1
                           from rr_accounting_periods_status s
                          where s.ledger_id = bu.ledger_id)
            then 'Y' else 'N' end as cal_exists,
       case
         when exists (select 1
                        from rr_accounting_periods_status s
                       where s.ledger_id = bu.ledger_id)
         then '<button type="button" class="t-Button t-Button--small" disabled '
           || 'title="Calendar already created">'
           || '<span class="t-Icon fa fa-calendar-check-o"></span>&nbsp;Calendar Exists</button>'
         else
           '<button type="button" class="t-Button t-Button--small t-Button--hot js-create-cal" '
           || 'data-ledger="' || bu.ledger_id || '" '
           || 'data-bu="'     || apex_escape.html_attribute(bu.bu_name) || '">'
           || '<span class="t-Icon fa fa-calendar-plus-o"></span>&nbsp;Create Calendar</button>'
       end as create_calendar
  from rr_business_units bu   -- <== your BU table/view
```

Column settings for `CREATE_CALENDAR`:
- Type: **Plain Text**, "Escape special characters" = **No**
- Heading: `Calendar`
- (Hide the `CAL_EXISTS` column or keep it as a Y/N badge.)

## 2. Modal dialog page (new page, e.g. **9541 – Create Calendar**)

Page mode: **Modal Dialog**. Items:

| Item | Type | Notes |
|---|---|---|
| `P9541_LEDGER_ID` | Hidden (protected: No) | set by the report button |
| `P9541_BU_NAME` | Display Only | context for the user |
| `P9541_CALENDAR_TYPE` | Radio Group | Static: `Fiscal (Apr–Mar);FISCAL`, `Calendar (Jan–Dec);CALENDAR`. Default `FISCAL` |
| `P9541_FIRST_PERIOD` | Text / Select | format `MON-YYYY`, e.g. `APR-2026`. This period is created **Open**; everything else `N` |
| `P9541_NUM_YEARS` | Number | Default `5` |
| `P9541_APPLICATION_IDS` | Text | Default `101,200,222,10037,10455` |

Default for `P9541_FIRST_PERIOD` (PL/SQL Expression, and re-run it in a
Dynamic Action on change of `P9541_CALENDAR_TYPE`):

```sql
case :P9541_CALENDAR_TYPE
  -- Fiscal year is Apr->Mar: suggest April of the current fiscal year
  when 'CALENDAR' then to_char(trunc(sysdate,'YYYY'), 'MON-YYYY')
  else to_char(add_months(trunc(add_months(sysdate,-3),'YYYY'), 3), 'MON-YYYY')
end
```

**Create** button submits the page; process (Processing → after submit):

```sql
declare
  l_rows number;
begin
  rr_calendar_pkg.create_calendar(
    p_ledger_id       => :P9541_LEDGER_ID,
    p_first_period    => :P9541_FIRST_PERIOD,
    p_calendar_type   => :P9541_CALENDAR_TYPE,
    p_num_years       => :P9541_NUM_YEARS,
    p_application_ids => :P9541_APPLICATION_IDS,
    p_created_by      => :APP_USER,
    x_rows_inserted   => l_rows);

  apex_application.g_print_success_message :=
    'Calendar created — ' || l_rows || ' period rows inserted.';
end;
```

Add a **Close Dialog** process after it. Validation errors from the package
(`-20801` calendar exists, `-20802` bad input) surface as normal APEX errors.

## 3. Wiring the row button to the modal (Business Units page)

Dynamic Action on the report region — Event **Click**, Selection Type
**jQuery Selector** = `.js-create-cal`, Action **Execute JavaScript Code**:

```js
var btn = this.triggeringElement;
apex.navigation.redirect(
  apex.util.applyTemplate(
    "f?p=&APP_ID.:9541:&SESSION.::NO:9541:P9541_LEDGER_ID,P9541_BU_NAME:" +
    encodeURIComponent(btn.dataset.ledger) + "," +
    encodeURIComponent(btn.dataset.bu)
  )
);
```

(Or generate the modal URL server-side with `apex_page.get_url` inside the
report SQL instead of a JS DA — either approach works; the JS variant keeps
the query simpler when checksums aren't required.)

Dialog Closed Dynamic Action on the region → **Refresh** the report, so the
button flips to the disabled **Calendar Exists** state immediately.

## 4. Existence check from outside APEX

- Existing: `GET /ords/bcldifc/reerp/currentperiodstatus` (current period only).
- New: `GET /ords/bcldifc/reerp/calendarstatus?ledger_id=NNN` returns
  `calendar_exists`, `period_count`, `first_period`, `last_period`,
  `open_period` — an empty `items` array means no calendar for that ledger.
- New: `POST /ords/bcldifc/reerp/createcalendar` (see script `02` header for
  the body). Returns `201` on success, `409` when the calendar already exists,
  `400` on bad input.

## Notes

- Generated structure matches the existing synced Fusion data exactly:
  fiscal Apr→Mar, `PERIOD_YEAR` = ending year, 16 periods/year including the
  four `Qn-Adj-yy-yy` zero-duration adjustment periods, and
  `EFFECTIVE_PERIOD_NUMBER = PERIOD_YEAR*10000 + PERIOD_NUMBER`.
- The sample data's fiscal years run **April to March** (Apr = period 1), so
  FISCAL defaults to an April start; pass `p_start_month => 3` if you ever
  need a March-start year instead.
- The unique key `(PERIOD_NAME_ID, APPLICATION_ID, LEDGER_ID)` plus the
  package's own exists-check make double-creation impossible.
- The no-delete trigger (`TRG_NODELETE_RR_ACCOUNTING_PERIODS_STA`) means a
  wrongly created calendar can't be removed from the app — verify the first
  period before creating, or lift `reerp_check_delete` temporarily to redo.
