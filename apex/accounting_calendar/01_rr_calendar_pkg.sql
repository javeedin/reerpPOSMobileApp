-- ============================================================================
-- RR_CALENDAR_PKG — generate accounting calendars into RR_ACCOUNTING_PERIODS_STATUS
-- Schema: BCLDIFC
--
-- Calendar structure (derived from existing synced Fusion data):
--   FISCAL   : year runs Apr -> Mar. PERIOD_YEAR = calendar year the fiscal
--              year ENDS in (Apr-2025..Mar-2026 => PERIOD_YEAR 2026).
--              16 periods/year: 12 months + 4 quarterly adjustment periods
--              (zero-duration rows on 30-Jun / 30-Sep / 31-Dec / 31-Mar,
--              ADJUSTMENT_PERIOD_FLAG = 'Y', names like 'Q1-Adj-25-26').
--              Period numbering: Apr=1 May=2 Jun=3 Q1Adj=4 Jul=5 ... Mar=15 Q4Adj=16.
--   CALENDAR : year runs Jan -> Dec. PERIOD_YEAR = calendar year.
--              12 monthly periods by default (no adjustment periods).
--
--   EFFECTIVE_PERIOD_NUMBER = PERIOD_YEAR * 10000 + PERIOD_NUMBER
--   Month period names: 'Mon-YY' (e.g. 'Apr-25') — matches existing data.
--
-- Statuses on creation: the requested FIRST period is created 'O' (Open),
-- every other generated period is 'N' (Never Opened).
-- One row is created per period per APPLICATION_ID (default GL/AP/AR + the
-- two custom apps present in existing data: 101,200,222,10037,10455).
-- ============================================================================

create or replace package rr_calendar_pkg as

  -- 'Y' if any calendar rows exist for the ledger, else 'N'
  function calendar_exists (p_ledger_id in number) return varchar2;

  -- Create a full calendar for a ledger.
  --   p_calendar_type   : 'FISCAL' (default, Apr->Mar) or 'CALENDAR' (Jan->Dec)
  --   p_first_period    : 'MON-YYYY' (e.g. 'APR-2025') — becomes the Open period.
  --   p_num_years       : how many fiscal/calendar years to generate (default 5)
  --   p_application_ids : comma list, default '101,200,222,10037,10455'
  --   p_adjustment_flag : 'Y'/'N' — default Y for FISCAL, N for CALENDAR
  --   p_start_month     : override year start month (default 4 for FISCAL, 1 for CALENDAR)
  -- Raises -20801 if a calendar already exists, -20802 on bad input.
  procedure create_calendar (
    p_ledger_id       in  number,
    p_first_period    in  varchar2,
    p_calendar_type   in  varchar2 default 'FISCAL',
    p_num_years       in  number   default 5,
    p_application_ids in  varchar2 default '101,200,222,10037,10455',
    p_adjustment_flag in  varchar2 default null,
    p_start_month     in  number   default null,
    p_created_by      in  varchar2 default null,
    x_rows_inserted   out number
  );

end rr_calendar_pkg;
/

create or replace package body rr_calendar_pkg as

  function calendar_exists (p_ledger_id in number) return varchar2 is
    l_cnt number;
  begin
    select count(*) into l_cnt
      from rr_accounting_periods_status
     where ledger_id = p_ledger_id
       and rownum = 1;
    return case when l_cnt > 0 then 'Y' else 'N' end;
  end calendar_exists;

  procedure create_calendar (
    p_ledger_id       in  number,
    p_first_period    in  varchar2,
    p_calendar_type   in  varchar2 default 'FISCAL',
    p_num_years       in  number   default 5,
    p_application_ids in  varchar2 default '101,200,222,10037,10455',
    p_adjustment_flag in  varchar2 default null,
    p_start_month     in  number   default null,
    p_created_by      in  varchar2 default null,
    x_rows_inserted   out number
  ) is
    l_type        varchar2(10) := upper(nvl(p_calendar_type, 'FISCAL'));
    l_adj         varchar2(1);
    l_start_month number;
    l_first_date  date;                -- first day of the requested Open period
    l_fy_start    date;                -- first day of the year containing it
    l_years       number := nvl(p_num_years, 5);
    l_user        varchar2(100) := nvl(p_created_by, user);
    l_rows        number := 0;

    l_month_start date;
    l_month_end   date;
    l_pnum        number;
    l_pyear       number;
    l_pname       varchar2(100);
    l_status      varchar2(10);
    l_month_idx   number;              -- 1..12 within the fiscal/calendar year

    procedure ins (
      p_name  varchar2, p_app number, p_status varchar2,
      p_start date, p_end date, p_year number, p_num number, p_adj varchar2
    ) is
    begin
      insert into rr_accounting_periods_status (
        period_name_id, application_id, ledger_id, closing_status,
        start_date, end_date, effective_period_number,
        period_year, period_number, adjustment_period_flag,
        created_by, last_updated_by
      ) values (
        p_name, p_app, p_ledger_id, p_status,
        p_start, p_end, p_year * 10000 + p_num,
        p_year, p_num, p_adj,
        l_user, l_user
      );
      l_rows := l_rows + 1;
    end ins;

  begin
    -- ---- validation --------------------------------------------------------
    if p_ledger_id is null then
      raise_application_error(-20802, 'p_ledger_id is required');
    end if;
    if l_type not in ('FISCAL', 'CALENDAR') then
      raise_application_error(-20802, 'p_calendar_type must be FISCAL or CALENDAR');
    end if;
    if calendar_exists(p_ledger_id) = 'Y' then
      raise_application_error(-20801,
        'Calendar already exists for ledger ' || p_ledger_id);
    end if;
    if l_years < 1 or l_years > 50 then
      raise_application_error(-20802, 'p_num_years must be between 1 and 50');
    end if;

    begin
      l_first_date := to_date(upper(p_first_period), 'MON-YYYY', 'NLS_DATE_LANGUAGE=AMERICAN');
    exception when others then
      raise_application_error(-20802,
        'p_first_period must be in MON-YYYY format (e.g. APR-2025), got: ' || p_first_period);
    end;

    l_adj         := upper(nvl(p_adjustment_flag, case l_type when 'FISCAL' then 'Y' else 'N' end));
    l_start_month := nvl(p_start_month,           case l_type when 'FISCAL' then 4   else 1   end);

    -- first day of the fiscal/calendar year that contains the first period
    l_fy_start := add_months(
                    trunc(l_first_date, 'YYYY'),
                    l_start_month - 1
                    + case when extract(month from l_first_date) < l_start_month then -12 else 0 end);

    -- ---- generation --------------------------------------------------------
    for yr in 0 .. l_years - 1 loop
      declare
        l_year_start date := add_months(l_fy_start, yr * 12);
      begin
        -- PERIOD_YEAR = calendar year the fiscal year ENDS in
        l_pyear := extract(year from add_months(l_year_start, 11));

        for m in 1 .. 12 loop
          l_month_idx   := m;
          l_month_start := add_months(l_year_start, m - 1);
          l_month_end   := last_day(l_month_start);
          l_pname       := to_char(l_month_start, 'Mon-YY', 'NLS_DATE_LANGUAGE=AMERICAN');
          l_status      := case when trunc(l_month_start, 'MM') = trunc(l_first_date, 'MM')
                                then 'O' else 'N' end;
          -- with adjustment periods, month period numbers skip the adj slots:
          -- m1=1 m2=2 m3=3 [adj=4] m4=5 ...  => n = m + floor((m-1)/3)
          l_pnum := case when l_adj = 'Y' then m + floor((m - 1) / 3) else m end;

          for app in (select to_number(trim(column_value)) as app_id
                        from table(apex_string.split(p_application_ids, ','))) loop
            ins(l_pname, app.app_id, l_status, l_month_start, l_month_end,
                l_pyear, l_pnum, 'N');
          end loop;

          -- quarterly adjustment period after months 3, 6, 9, 12
          if l_adj = 'Y' and mod(m, 3) = 0 then
            declare
              l_q     number := m / 3;
              l_qname varchar2(100) :=
                'Q' || l_q || '-Adj-'
                || to_char(l_year_start, 'YY') || '-'
                || to_char(add_months(l_year_start, 11), 'YY');
            begin
              for app in (select to_number(trim(column_value)) as app_id
                            from table(apex_string.split(p_application_ids, ','))) loop
                ins(l_qname, app.app_id, 'N', l_month_end, l_month_end,
                    l_pyear, l_q * 4, 'Y');
              end loop;
            end;
          end if;
        end loop;
      end;
    end loop;

    x_rows_inserted := l_rows;
  end create_calendar;

end rr_calendar_pkg;
/
