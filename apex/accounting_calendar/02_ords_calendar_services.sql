-- ============================================================================
-- ORDS services for accounting calendar (schema BCLDIFC, module base /reerp/)
-- Adds two handlers alongside the existing /reerp/currentperiodstatus:
--
--   GET  /ords/bcldifc/reerp/calendarstatus?ledger_id=NNN
--        -> { "calendar_exists": "Y|N", "period_count": n,
--             "first_period": ..., "last_period": ..., "open_period": ... }
--        Without ledger_id: one summary row per ledger that has a calendar.
--
--   POST /ords/bcldifc/reerp/createcalendar
--        body: { "p_ledger_id": 300000099999999,
--                "p_calendar_type": "FISCAL",          -- or "CALENDAR"
--                "p_first_period": "APR-2026",         -- MON-YYYY, becomes Open
--                "p_num_years": 5,                     -- optional
--                "p_application_ids": "101,200,222,10037,10455",  -- optional
--                "p_created_by": "JAVEED" }            -- optional
--        -> 201 { "status": "success", "rows_inserted": 400, ... }
--        -> 409 if the calendar already exists, 400 on bad input.
-- ============================================================================

begin
  -- Reuse the existing 'reerp' module (same one that serves currentperiodstatus).
  -- NOTE: if your module is registered under a different name than 'reerp'
  -- (check: select name, uri_prefix from user_ords_modules), replace
  -- p_module_name below with that name — the uri_prefix is what must be 'reerp/'.
  ords.define_template(
    p_module_name => 'reerp',
    p_pattern     => 'calendarstatus');

  ords.define_handler(
    p_module_name => 'reerp',
    p_pattern     => 'calendarstatus',
    p_method      => 'GET',
    p_source_type => ords.source_type_collection_feed,
    p_source      => q'[
      select s.ledger_id,
             'Y'                                          as calendar_exists,
             count(*)                                     as period_count,
             min(s.start_date)                            as calendar_start,
             max(s.end_date)                              as calendar_end,
             min(s.period_name_id)
               keep (dense_rank first order by s.effective_period_number)
                                                          as first_period,
             max(s.period_name_id)
               keep (dense_rank last  order by s.effective_period_number)
                                                          as last_period,
             max(case when s.closing_status = 'O'
                      then s.period_name_id end)          as open_period
        from rr_accounting_periods_status s
       where (:ledger_id is null or s.ledger_id = to_number(:ledger_id))
       group by s.ledger_id
       order by s.ledger_id
    ]');

  ords.define_template(
    p_module_name => 'reerp',
    p_pattern     => 'createcalendar');

  ords.define_handler(
    p_module_name => 'reerp',
    p_pattern     => 'createcalendar',
    p_method      => 'POST',
    p_source_type => ords.source_type_plsql,
    p_source      => q'[
      declare
        l_rows number;
      begin
        rr_calendar_pkg.create_calendar(
          p_ledger_id       => :p_ledger_id,
          p_first_period    => :p_first_period,
          p_calendar_type   => nvl(:p_calendar_type, 'FISCAL'),
          p_num_years       => nvl(:p_num_years, 5),
          p_application_ids => nvl(:p_application_ids, '101,200,222,10037,10455'),
          p_created_by      => :p_created_by,
          x_rows_inserted   => l_rows);

        :status_code := 201;
        apex_json.open_object;
        apex_json.write('status', 'success');
        apex_json.write('ledger_id', :p_ledger_id);
        apex_json.write('rows_inserted', l_rows);
        apex_json.write('message', 'Calendar created for ledger ' || :p_ledger_id);
        apex_json.close_object;
      exception
        when others then
          rollback;
          :status_code := case when sqlcode = -20801 then 409 else 400 end;
          apex_json.open_object;
          apex_json.write('status', 'error');
          apex_json.write('message', sqlerrm);
          apex_json.close_object;
      end;
    ]');

  commit;
end;
/

-- Quick tests -----------------------------------------------------------------
-- GET  https://<host>/ords/bcldifc/reerp/calendarstatus?ledger_id=300000002671369
-- POST https://<host>/ords/bcldifc/reerp/createcalendar
--      { "p_ledger_id": 300000012345678, "p_calendar_type": "FISCAL",
--        "p_first_period": "APR-2026", "p_num_years": 5, "p_created_by": "JAVEED" }
