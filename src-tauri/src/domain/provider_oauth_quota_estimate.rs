//! Usage: Estimate OAuth window capacity from local cost and upstream utilization.

use crate::shared::error::{db_err, AppResult};
use rusqlite::{params, Connection};

const USD_FEMTO_DENOM: f64 = 1_000_000_000_000_000.0;
const WINDOW_COST_SQL: &str = r#"
SELECT
  TOTAL(CASE WHEN cost_usd_femto >= 0 THEN cost_usd_femto ELSE 0 END),
  COUNT(*),
  COUNT(CASE WHEN cost_usd_femto IS NULL OR cost_usd_femto < 0 THEN 1 END)
FROM (
  SELECT cost_usd_femto FROM request_logs
  WHERE final_provider_id = ?1 AND created_at >= ?2 AND created_at <= ?3
    AND COALESCE(NULLIF(created_at_ms, 0), created_at * 1000) + COALESCE(duration_ms, 0) >= ?4
    AND COALESCE(NULLIF(created_at_ms, 0), created_at * 1000) + COALESCE(duration_ms, 0) <= ?5
    AND excluded_from_stats = 0 AND status >= 200 AND status < 300 AND error_code IS NULL
  UNION ALL
  SELECT cost_usd_femto FROM request_logs
  WHERE cost_source_provider_id = ?1 AND created_at >= ?2 AND created_at <= ?3
    AND final_provider_id IS NOT ?1
    AND COALESCE(NULLIF(created_at_ms, 0), created_at * 1000) + COALESCE(duration_ms, 0) >= ?4
    AND COALESCE(NULLIF(created_at_ms, 0), created_at * 1000) + COALESCE(duration_ms, 0) <= ?5
    AND excluded_from_stats = 0 AND status >= 200 AND status < 300 AND error_code IS NULL
)
"#;

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub(crate) struct OAuthQuotaEstimate {
    pub used_usd: Option<f64>,
    pub estimated_total_usd: Option<f64>,
    pub estimated_remaining_usd: Option<f64>,
    pub window_start: i64,
    pub window_end: i64,
    pub sample_count: i64,
    pub unpriced_count: i64,
}

#[derive(Debug, Clone, Default, serde::Serialize, specta::Type)]
pub(crate) struct ProviderOAuthQuotaEstimates {
    pub short: Option<OAuthQuotaEstimate>,
    pub weekly: Option<OAuthQuotaEstimate>,
}

#[derive(Debug, Clone, Default, PartialEq, serde::Serialize, serde::Deserialize)]
pub(crate) struct ProviderOAuthQuotaBaselines {
    pub short: Option<OAuthQuotaBaseline>,
    pub weekly: Option<OAuthQuotaBaseline>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub(crate) struct OAuthQuotaBaseline {
    window_start: i64,
    window_end: i64,
    #[serde(default)]
    sample_start_at_ms: Option<i64>,
    used_percent: f64,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct OAuthQuotaWindow {
    pub remaining_percent: Option<f64>,
    pub reset_at: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub cost_start_at: Option<i64>,
}

// Call in the same transaction as the operation that invalidates the samples.
pub(crate) fn invalidate_sampling(
    tx: &rusqlite::Transaction<'_>,
    provider_id: Option<i64>,
) -> AppResult<()> {
    tx.execute(
        "UPDATE providers SET oauth_quota_baselines_json = NULL
         WHERE (?1 IS NULL OR id = ?1) AND auth_mode = 'oauth'",
        [provider_id],
    )
    .map_err(|e| db_err!("failed to reset OAuth quota sampling: {e}"))?;
    tx.execute(
        "UPDATE provider_oauth_limit_snapshots SET revision = revision + 1
         WHERE ?1 IS NULL OR provider_id = ?1",
        [provider_id],
    )
    .map_err(|e| db_err!("failed to invalidate pre-reset quota sample: {e}"))?;
    Ok(())
}

/// Match local costs to the utilization change since the first quota sample.
pub(crate) fn estimate_window(
    conn: &Connection,
    provider_id: i64,
    window: OAuthQuotaWindow,
    now_ms: i64,
    baseline: &mut Option<OAuthQuotaBaseline>,
) -> AppResult<Option<OAuthQuotaEstimate>> {
    let now_unix = now_ms / 1000;
    let Some(remaining) = window
        .remaining_percent
        .filter(|value| value.is_finite() && (0.0..=100.0).contains(value))
    else {
        return Ok(None);
    };
    let Some((reset_at, duration)) = window.reset_at.zip(window.duration_seconds) else {
        return Ok(None);
    };
    if provider_id <= 0 || duration <= 0 || duration > 31 * 24 * 3600 || reset_at <= now_unix {
        return Ok(None);
    }
    let Some(start_at) = reset_at
        .checked_sub(duration)
        .filter(|start| *start <= now_unix)
    else {
        return Ok(None);
    };
    let cost_start_at = start_at.max(window.cost_start_at.unwrap_or(start_at));
    let current_used_percent = 100.0 - remaining;
    if !baseline.as_ref().is_some_and(|baseline| {
        baseline.window_start == start_at
            && baseline.window_end == reset_at
            && baseline
                .sample_start_at_ms
                .is_some_and(|sample| sample >= cost_start_at * 1000)
            && baseline.used_percent <= current_used_percent
    }) {
        *baseline = Some(OAuthQuotaBaseline {
            window_start: start_at,
            window_end: reset_at,
            sample_start_at_ms: Some(now_ms.saturating_add(1).max(cost_start_at * 1000)),
            used_percent: current_used_percent,
        });
    }
    let baseline = baseline.as_ref().expect("initialized quota baseline");

    // Account ownership still follows request start; sampling follows completion
    // so requests in flight at the first observation are not permanently lost.
    // TOTAL avoids SQLite integer-SUM overflow. Like sub2api, estimate from
    // recorded costs even when other requests are unpriced. Keep their count
    // so the UI can explain that the estimate may be incomplete.
    let (cost_femto, sample_count, unpriced_count): (f64, i64, i64) = conn
        .query_row(
            WINDOW_COST_SQL,
            params![
                provider_id,
                cost_start_at,
                now_unix,
                baseline.sample_start_at_ms,
                now_ms
            ],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| db_err!("failed to query OAuth quota estimate costs: {e}"))?;
    let used_usd = (sample_count > unpriced_count && cost_femto.is_finite())
        .then_some(cost_femto / USD_FEMTO_DENOM);
    let used_percent = current_used_percent - baseline.used_percent;
    let estimated_total_usd = used_usd
        .filter(|used| *used > 0.0 && used_percent > 0.0)
        .map(|used| used * 100.0 / used_percent)
        .filter(|total| total.is_finite() && *total > 0.0);

    Ok(Some(OAuthQuotaEstimate {
        used_usd,
        estimated_total_usd,
        estimated_remaining_usd: estimated_total_usd.map(|total| total * remaining / 100.0),
        window_start: start_at,
        window_end: reset_at,
        sample_count,
        unpriced_count,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_completing_after_baseline_keeps_cost_and_usage_aligned() {
        let conn = database();
        conn.execute(
            "INSERT INTO request_logs(final_provider_id, created_at, status, cost_usd_femto)
             VALUES (1, ?1, NULL, NULL)",
            [NOW - 60],
        )
        .unwrap();
        let mut baseline = None;
        estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline).unwrap();

        // The already-running request finishes after the quota observation.
        // Its request-start timestamp is preserved by request_logs' upsert.
        conn.execute(
            "UPDATE request_logs SET status = 200, duration_ms = 65000, cost_usd_femto = 1000000000000000",
            [],
        ).unwrap();
        estimate_at_seconds(&conn, 1, window(75.0), NOW + 5, &mut baseline).unwrap();
        insert(&conn, 1, NOW + 10, Some(1_000_000_000_000_000));
        let next = estimate_at_seconds(&conn, 1, window(70.0), NOW + 15, &mut baseline)
            .unwrap()
            .unwrap();
        assert_eq!(
            next.estimated_total_usd,
            Some(20.0),
            "two $1 requests consumed 10 percentage points after the baseline"
        );
    }

    #[test]
    fn quota_estimate_uses_millisecond_completion_boundary_and_keeps_login_isolation() {
        let conn = database();
        // Same-second completions before and after the observation, plus a
        // previous account's long-running request completing after login.
        for (start_ms, duration_ms, cost) in
            [(NOW * 1000 + 100, 200, 50), ((NOW - 60) * 1000, 61_000, 50)]
        {
            conn.execute(
                "INSERT INTO request_logs(final_provider_id, created_at, created_at_ms, duration_ms, status, cost_usd_femto)
                 VALUES (1, ?1, ?2, ?3, 200, ?4)",
                params![start_ms / 1000, start_ms, duration_ms, cost * 1_000_000_000_000_000_i64],
            ).unwrap();
        }
        let current_window = OAuthQuotaWindow {
            cost_start_at: Some(NOW),
            ..window(80.0)
        };
        let mut baseline = None;
        estimate_window(&conn, 1, current_window, NOW * 1000 + 500, &mut baseline).unwrap();
        conn.execute(
            "INSERT INTO request_logs(final_provider_id, created_at, created_at_ms, duration_ms, status, cost_usd_femto)
             VALUES (1, ?1, ?2, 100, 200, 1000000000000000)",
            params![NOW, NOW * 1000 + 600],
        ).unwrap();
        let next = estimate_window(
            &conn,
            1,
            OAuthQuotaWindow {
                remaining_percent: Some(75.0),
                ..current_window
            },
            (NOW + 2) * 1000,
            &mut baseline,
        )
        .unwrap()
        .unwrap();
        assert_eq!(next.sample_count, 1);
        assert_eq!(next.used_usd, Some(1.0));
        assert_eq!(next.estimated_total_usd, Some(20.0));
    }

    #[test]
    fn quota_estimate_excludes_backfilled_costs_completed_before_sampling() {
        let conn = database();
        insert(&conn, 1, NOW - 10, None);
        let mut baseline = None;
        estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline).unwrap();
        conn.execute(
            "UPDATE request_logs SET cost_usd_femto = 50000000000000000",
            [],
        )
        .unwrap();
        insert(&conn, 1, NOW + 1, Some(1_000_000_000_000_000));
        let next = estimate_at_seconds(&conn, 1, window(75.0), NOW + 2, &mut baseline)
            .unwrap()
            .unwrap();
        assert_eq!(next.used_usd, Some(1.0));
        assert_eq!(next.estimated_total_usd, Some(20.0));
    }

    #[test]
    fn quota_estimate_restarts_legacy_second_based_samples() {
        let conn = database();
        let mut baseline = serde_json::from_value(serde_json::json!({
            "window_start": START, "window_end": RESET,
            "sample_start_at": NOW - 30, "used_percent": 10.0
        }))
        .unwrap();
        insert(&conn, 1, NOW - 10, Some(1_000_000_000_000_000));
        let first = estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline)
            .unwrap()
            .unwrap();
        assert!(first.estimated_total_usd.is_none());
        assert_eq!(baseline.unwrap().used_percent, 20.0);
    }

    #[test]
    fn clearing_request_logs_restarts_the_sampling_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let db = crate::db::init_for_tests(&dir.path().join("review-clear.db")).unwrap();
        let mut baseline = None;
        {
            let conn = db.open_connection().unwrap();
            conn.execute_batch(
                "INSERT INTO providers(id, cli_key, name, base_url, api_key_plaintext,
                   created_at, updated_at, auth_mode, oauth_access_token)
                 VALUES (1, 'codex', 'test', '', '', 1, 1, 'oauth', 'same-account');",
            )
            .unwrap();
            estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline).unwrap();
            conn.execute(
                "INSERT INTO request_logs(trace_id, cli_key, method, path, status,
                   final_provider_id, created_at, cost_usd_femto)
                 VALUES ('before-clear', 'codex', 'POST', '/responses', 200, 1, ?1, 2000000000000000)",
                [NOW + 5],
            ).unwrap();
            let before = estimate_at_seconds(&conn, 1, window(70.0), NOW + 10, &mut baseline)
                .unwrap()
                .unwrap();
            assert_eq!(before.estimated_total_usd, Some(20.0));
            let json = serde_json::to_string(&ProviderOAuthQuotaBaselines {
                short: baseline,
                weekly: None,
            })
            .unwrap();
            conn.execute(
                "UPDATE providers SET oauth_quota_baselines_json = ?1 WHERE id = 1",
                [json],
            )
            .unwrap();
        }
        crate::data_management::request_logs_clear_all(&db).unwrap();
        let conn = db.open_connection().unwrap();
        let json: Option<String> = conn
            .query_row(
                "SELECT oauth_quota_baselines_json FROM providers WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let mut after: ProviderOAuthQuotaBaselines = json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()
            .unwrap()
            .unwrap_or_default();
        estimate_at_seconds(&conn, 1, window(70.0), NOW + 20, &mut after.short).unwrap();
        conn.execute(
            "INSERT INTO request_logs(trace_id, cli_key, method, path, status,
               final_provider_id, created_at, cost_usd_femto)
             VALUES ('after-clear', 'codex', 'POST', '/responses', 200, 1, ?1, 1000000000000000)",
            [NOW + 25],
        )
        .unwrap();
        let next = estimate_at_seconds(&conn, 1, window(65.0), NOW + 30, &mut after.short)
            .unwrap()
            .unwrap();
        assert_eq!(
            next.estimated_total_usd,
            Some(20.0),
            "after clearing the samples, new $1 cost must correspond to the new 5-point growth"
        );
    }

    #[test]
    fn retention_invalidates_deleted_samples_including_bridge_costs_only() {
        let dir = tempfile::tempdir().unwrap();
        let db = crate::db::init_for_tests(&dir.path().join("retention-quota.db")).unwrap();
        let conn = db.open_connection().unwrap();
        let day = 24 * 3600;
        for id in [1, 2, 3, 5] {
            let sample_at = if id == 2 { NOW - 100 } else { NOW - 3 * day };
            let baseline = ProviderOAuthQuotaBaselines {
                short: None,
                weekly: Some(OAuthQuotaBaseline {
                    window_start: NOW - 6 * day,
                    window_end: NOW + day,
                    sample_start_at_ms: Some(sample_at * 1000),
                    used_percent: 20.0,
                }),
            };
            conn.execute(
                "INSERT INTO providers(id, cli_key, name, base_url, api_key_plaintext, created_at, updated_at,
                   auth_mode, oauth_access_token, oauth_quota_baselines_json, oauth_cost_start_at)
                 VALUES (?1, 'codex', 'retention-' || ?1, '', '', 1, 1, 'oauth', 'token', ?2, ?3)",
                params![id, serde_json::to_string(&baseline).unwrap(), if id == 5 { NOW } else { NOW - 6 * day }],
            ).unwrap();
            conn.execute(
                "INSERT INTO provider_oauth_limit_snapshots(provider_id, checked_at, updated_at, revision)
                 VALUES (?1, 1, 1, 3)", [id],
            ).unwrap();
            conn.execute(
                "INSERT INTO request_logs(trace_id, cli_key, method, path, status, final_provider_id,
                   cost_source_provider_id, created_at, cost_usd_femto)
                 VALUES (?1, 'codex', 'POST', '/responses', 200, ?2, ?3, ?4, 1000000000000000)",
                params![format!("expired-{id}"), if id == 3 { 4 } else { id },
                    if id == 3 { Some(3) } else { None }, NOW - 2 * day],
            ).unwrap();
        }
        drop(conn);
        assert_eq!(crate::request_logs::purge_expired(&db, 1, NOW).unwrap(), 4);
        let conn = db.open_connection().unwrap();
        for id in [1, 2, 3, 5] {
            let (baseline, revision): (Option<String>, i64) = conn
                .query_row(
                    "SELECT p.oauth_quota_baselines_json, s.revision FROM providers p
                 JOIN provider_oauth_limit_snapshots s ON p.id = s.provider_id WHERE p.id = ?1",
                    [id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();
            let affected = id == 1 || id == 3;
            assert_eq!(baseline.is_none(), affected, "provider {id}");
            assert_eq!(revision, if affected { 4 } else { 3 }, "provider {id}");
        }
    }

    const NOW: i64 = 1_800_000_000;
    const START: i64 = NOW - 3600;
    const RESET: i64 = START + 5 * 3600;

    fn database() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE request_logs (
              final_provider_id INTEGER, created_at INTEGER, status INTEGER,
              excluded_from_stats INTEGER DEFAULT 0, error_code TEXT, cost_usd_femto INTEGER,
              special_settings_json TEXT, cost_source_provider_id INTEGER,
              created_at_ms INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0
            );",
        )
        .unwrap();
        conn
    }

    fn insert(conn: &Connection, provider: i64, at: i64, cost: Option<i64>) {
        conn.execute(
            "INSERT INTO request_logs(final_provider_id, created_at, status, cost_usd_femto)
             VALUES (?1, ?2, 200, ?3)",
            params![provider, at, cost],
        )
        .unwrap();
    }

    fn window(remaining: f64) -> OAuthQuotaWindow {
        OAuthQuotaWindow {
            remaining_percent: Some(remaining),
            reset_at: Some(RESET),
            duration_seconds: Some(5 * 3600),
            cost_start_at: None,
        }
    }

    fn estimate_at_seconds(
        conn: &Connection,
        provider_id: i64,
        window: OAuthQuotaWindow,
        now_unix: i64,
        baseline: &mut Option<OAuthQuotaBaseline>,
    ) -> AppResult<Option<OAuthQuotaEstimate>> {
        estimate_window(conn, provider_id, window, now_unix * 1000, baseline)
    }

    fn estimate_from_window_start(
        conn: &Connection,
        provider_id: i64,
        window: OAuthQuotaWindow,
        now_unix: i64,
    ) -> AppResult<Option<OAuthQuotaEstimate>> {
        let start = window.reset_at.unwrap_or(0) - window.duration_seconds.unwrap_or(0);
        let mut baseline = Some(OAuthQuotaBaseline {
            window_start: start,
            window_end: window.reset_at.unwrap_or(0),
            sample_start_at_ms: Some(start.max(window.cost_start_at.unwrap_or(start)) * 1000),
            used_percent: 0.0,
        });
        estimate_at_seconds(conn, provider_id, window, now_unix, &mut baseline)
    }

    #[test]
    fn quota_estimate_matches_cost_and_utilization_since_the_first_sample() {
        let conn = database();
        insert(&conn, 1, START, Some(20_000_000_000_000_000));
        insert(&conn, 1, NOW, Some(5_000_000_000_000_000));
        let mut baseline = None;
        let first = estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline)
            .unwrap()
            .unwrap();
        assert_eq!(first.sample_count, 0);
        assert!(first.estimated_total_usd.is_none());

        insert(&conn, 1, NOW + 5, Some(1_000_000_000_000_000));
        let next = estimate_at_seconds(&conn, 1, window(75.0), NOW + 10, &mut baseline)
            .unwrap()
            .unwrap();
        assert_eq!(next.used_usd, Some(1.0));
        assert_eq!(next.estimated_total_usd, Some(20.0));
        assert_eq!(next.estimated_remaining_usd, Some(15.0));
        assert_eq!(next.sample_count, 1);

        insert(&conn, 1, NOW + 15, Some(1_000_000_000_000_000));
        let next = estimate_at_seconds(&conn, 1, window(70.0), NOW + 20, &mut baseline)
            .unwrap()
            .unwrap();
        assert_eq!(next.used_usd, Some(2.0));
        assert_eq!(next.estimated_total_usd, Some(20.0));
        assert_eq!(next.estimated_remaining_usd, Some(14.0));
    }

    #[test]
    fn quota_estimate_maintains_independent_short_and_weekly_samples() {
        let conn = database();
        let mut baselines = ProviderOAuthQuotaBaselines::default();
        let weekly = OAuthQuotaWindow {
            duration_seconds: Some(7 * 24 * 3600),
            reset_at: Some(START + 7 * 24 * 3600),
            remaining_percent: Some(83.0),
            ..window(96.0)
        };
        estimate_at_seconds(&conn, 1, window(96.0), NOW, &mut baselines.short).unwrap();
        estimate_at_seconds(&conn, 1, weekly, NOW, &mut baselines.weekly).unwrap();
        insert(&conn, 1, NOW + 5, Some(1_000_000_000_000_000));
        let short = estimate_at_seconds(&conn, 1, window(91.0), NOW + 10, &mut baselines.short)
            .unwrap()
            .unwrap();
        let weekly = estimate_at_seconds(
            &conn,
            1,
            OAuthQuotaWindow {
                remaining_percent: Some(82.0),
                ..weekly
            },
            NOW + 10,
            &mut baselines.weekly,
        )
        .unwrap()
        .unwrap();
        assert_eq!(short.estimated_total_usd, Some(20.0));
        assert_eq!(weekly.estimated_total_usd, Some(100.0));
        assert_eq!(weekly.estimated_remaining_usd, Some(82.0));
    }

    #[test]
    fn quota_estimate_restarts_after_rollover_or_utilization_reset() {
        let conn = database();
        let mut baseline = None;
        estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline).unwrap();
        insert(&conn, 1, NOW + 5, Some(50_000_000_000_000_000));

        let next_window = OAuthQuotaWindow {
            reset_at: Some(RESET + 5 * 3600),
            ..window(90.0)
        };
        let rolled = estimate_at_seconds(&conn, 1, next_window, RESET + 10, &mut baseline)
            .unwrap()
            .unwrap();
        assert!(rolled.estimated_total_usd.is_none());
        insert(&conn, 1, RESET + 15, Some(1_000_000_000_000_000));
        let next = estimate_at_seconds(
            &conn,
            1,
            OAuthQuotaWindow {
                remaining_percent: Some(85.0),
                ..next_window
            },
            RESET + 20,
            &mut baseline,
        )
        .unwrap()
        .unwrap();
        assert_eq!(next.estimated_total_usd, Some(20.0));

        let reset = estimate_at_seconds(
            &conn,
            1,
            OAuthQuotaWindow {
                remaining_percent: Some(100.0),
                ..next_window
            },
            RESET + 25,
            &mut baseline,
        )
        .unwrap()
        .unwrap();
        assert!(reset.estimated_total_usd.is_none());
        assert_eq!(reset.sample_count, 0);
    }

    #[test]
    fn quota_estimate_waits_for_cost_and_percent_growth() {
        let conn = database();
        let mut baseline = None;
        estimate_at_seconds(&conn, 1, window(80.0), NOW, &mut baseline).unwrap();
        let no_cost = estimate_at_seconds(&conn, 1, window(75.0), NOW + 5, &mut baseline)
            .unwrap()
            .unwrap();
        assert!(no_cost.estimated_total_usd.is_none());

        insert(&conn, 1, NOW + 10, Some(1_000_000_000_000_000));
        let no_growth = estimate_at_seconds(&conn, 1, window(80.0), NOW + 15, &mut baseline)
            .unwrap()
            .unwrap();
        assert!(no_growth.estimated_total_usd.is_none());
        let next = estimate_at_seconds(&conn, 1, window(75.0), NOW + 20, &mut baseline)
            .unwrap()
            .unwrap();
        assert_eq!(next.estimated_total_usd, Some(20.0));
    }

    #[test]
    fn quota_estimate_matches_sub2api_formula_and_actual_window() {
        let conn = database();
        insert(&conn, 1, START, Some(10_000_000_000_000_000));
        insert(&conn, 1, NOW, Some(10_000_000_000_000_000));
        let estimate = estimate_from_window_start(&conn, 1, window(80.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(estimate.used_usd, Some(20.0));
        assert_eq!(estimate.estimated_total_usd, Some(100.0));
        assert_eq!(estimate.estimated_remaining_usd, Some(80.0));
        assert_eq!((estimate.window_start, estimate.window_end), (START, RESET));
        assert_eq!(estimate.sample_count, 2);

        let weekly = OAuthQuotaWindow {
            duration_seconds: Some(7 * 24 * 3600),
            reset_at: Some(START + 7 * 24 * 3600),
            ..window(80.0)
        };
        assert_eq!(
            estimate_from_window_start(&conn, 1, weekly, NOW)
                .unwrap()
                .unwrap()
                .estimated_total_usd,
            Some(100.0)
        );
    }

    #[test]
    fn quota_estimate_excludes_other_accounts_failed_excluded_and_out_of_window_requests() {
        let conn = database();
        insert(&conn, 1, START, Some(1_000_000_000_000_000));
        for (provider, at) in [(2, NOW), (1, START - 1), (1, NOW + 1)] {
            insert(&conn, provider, at, Some(100_000_000_000_000_000));
        }
        for (status, excluded, error) in [
            (500, 0, None),
            (199, 0, None),
            (300, 0, None),
            (200, 1, None),
            (200, 0, Some("upstream_error")),
        ] {
            conn.execute(
                "INSERT INTO request_logs(final_provider_id, created_at, status, excluded_from_stats, error_code, cost_usd_femto)
                 VALUES (1, ?1, ?2, ?3, ?4, 100000000000000000)",
                params![NOW, status, excluded, error],
            )
            .unwrap();
        }
        let estimate = estimate_from_window_start(&conn, 1, window(50.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(estimate.used_usd, Some(1.0));
        assert_eq!(estimate.estimated_total_usd, Some(2.0));
        assert_eq!(estimate.sample_count, 1);
    }

    #[test]
    fn quota_estimate_excludes_prior_login_direct_and_bridge_costs() {
        let conn = database();
        for (provider, at, cost) in [(1, NOW - 1, 10), (2, NOW - 1, 10), (1, NOW, 1), (2, NOW, 2)] {
            insert(&conn, provider, at, Some(cost * 1_000_000_000_000_000));
        }
        conn.execute(
            "UPDATE request_logs SET cost_source_provider_id = 1 WHERE final_provider_id = 2",
            [],
        )
        .unwrap();
        let current = OAuthQuotaWindow {
            cost_start_at: Some(NOW),
            ..window(80.0)
        };
        let estimate = estimate_from_window_start(&conn, 1, current, NOW)
            .unwrap()
            .unwrap();
        assert_eq!(estimate.used_usd, Some(3.0));
        assert_eq!(estimate.estimated_total_usd, Some(15.0));
        assert_eq!(estimate.sample_count, 2);
        assert_eq!(estimate.window_start, START);

        let just_logged_in = OAuthQuotaWindow {
            cost_start_at: Some(NOW + 1),
            ..current
        };
        let empty = estimate_from_window_start(&conn, 1, just_logged_in, NOW)
            .unwrap()
            .unwrap();
        assert_eq!(empty.sample_count, 0);
        assert!(empty.estimated_total_usd.is_none());
    }

    #[test]
    fn quota_estimate_queries_each_provider_through_an_index() {
        let dir = tempfile::tempdir().unwrap();
        let db = crate::db::init_for_tests(&dir.path().join("quota-index.db")).unwrap();
        let conn = db.open_connection().unwrap();
        let plan: Vec<String> = conn
            .prepare(&format!("EXPLAIN QUERY PLAN {WINDOW_COST_SQL}"))
            .unwrap()
            .query_map(params![1, START, NOW, START * 1000, NOW * 1000], |row| {
                row.get(3)
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(
            plan.iter().any(|step| {
                step.contains("SEARCH request_logs") && step.contains("final_provider_id=?")
            }),
            "{plan:?}"
        );
        assert!(
            plan.iter().any(|step| {
                step.contains("idx_request_logs_cost_source_created_at")
                    && step.contains("cost_source_provider_id=?")
            }),
            "{plan:?}"
        );
        assert!(!plan.iter().any(|step| step.contains("SCAN request_logs")));
    }

    #[test]
    fn quota_estimate_uses_priced_samples_when_other_costs_are_missing() {
        let conn = database();
        let empty = estimate_from_window_start(&conn, 1, window(80.0), NOW)
            .unwrap()
            .unwrap();
        assert!(empty.used_usd.is_none());
        assert!(empty.estimated_total_usd.is_none());
        assert!(empty.estimated_remaining_usd.is_none());
        for cost in [None, Some(-1)] {
            insert(&conn, 1, NOW, cost);
        }
        let unpriced = estimate_from_window_start(&conn, 1, window(80.0), NOW)
            .unwrap()
            .unwrap();
        assert!(unpriced.used_usd.is_none());
        assert!(unpriced.estimated_total_usd.is_none());
        assert!(unpriced.estimated_remaining_usd.is_none());
        assert_eq!(unpriced.unpriced_count, 2);
        insert(&conn, 1, NOW, Some(1_000_000_000_000_000));
        let partial = estimate_from_window_start(&conn, 1, window(80.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(partial.used_usd, Some(1.0));
        assert_eq!(partial.sample_count, 3);
        assert_eq!(partial.unpriced_count, 2);
        assert_eq!(partial.estimated_total_usd, Some(5.0));
        assert_eq!(partial.estimated_remaining_usd, Some(4.0));
    }

    #[test]
    fn quota_estimate_keeps_recalculating_after_an_unpriced_request() {
        let conn = database();
        insert(&conn, 1, NOW, Some(20_000_000_000_000_000));
        let initial = estimate_from_window_start(&conn, 1, window(80.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(initial.estimated_total_usd, Some(100.0));
        assert_eq!(initial.unpriced_count, 0);

        insert(&conn, 1, NOW, None);
        let partial = estimate_from_window_start(&conn, 1, window(80.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(partial.estimated_total_usd, Some(100.0));
        assert_eq!(partial.estimated_remaining_usd, Some(80.0));
        assert_eq!(partial.unpriced_count, 1);

        insert(&conn, 1, NOW, Some(10_000_000_000_000_000));
        let updated = estimate_from_window_start(&conn, 1, window(75.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(updated.used_usd, Some(30.0));
        assert_eq!(updated.estimated_total_usd, Some(120.0));
        assert_eq!(updated.estimated_remaining_usd, Some(90.0));
        assert_eq!(updated.unpriced_count, 1);
    }

    #[test]
    fn quota_estimate_includes_bridge_costs_using_recorded_source_identity_once() {
        let conn = database();
        insert(&conn, 1, NOW, Some(1_000_000_000_000_000));
        conn.execute(
            "UPDATE request_logs SET cost_source_provider_id = 1 WHERE final_provider_id = 1",
            [],
        )
        .unwrap();
        for (bridge, source, recorded_bridge, amount) in
            [(2, 1, 2, 3), (3, 1, 3, 2), (4, 1, 99, 10), (5, 88, 5, 10)]
        {
            insert(&conn, bridge, NOW, Some(amount * 1_000_000_000_000_000));
            let identity = serde_json::json!({
                "type": "cx2cc_cost_basis", "source_provider_id": source,
                "bridge_provider_id": recorded_bridge,
            });
            let settings = serde_json::json!(["not JSON", null, 7, true, identity, identity]);
            conn.execute(
                "UPDATE request_logs SET special_settings_json = ?1, cost_source_provider_id = ?3
                 WHERE final_provider_id = ?2",
                params![
                    settings.to_string(),
                    bridge,
                    crate::request_logs::semantics::resolve_cx2cc_source_provider_id(
                        Some(&settings.to_string()),
                        Some(bridge),
                    ),
                ],
            )
            .unwrap();
        }
        for (provider, malformed) in [
            (6, "not JSON"),
            (7, "null"),
            (8, r#"{"source_provider_id":1}"#),
        ] {
            insert(&conn, provider, NOW, Some(10_000_000_000_000_000));
            conn.execute(
                "UPDATE request_logs SET special_settings_json = ?1 WHERE final_provider_id = ?2",
                params![malformed, provider],
            )
            .unwrap();
        }
        let estimate = estimate_from_window_start(&conn, 1, window(50.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(estimate.sample_count, 3);
        assert_eq!(estimate.used_usd, Some(6.0));
        assert_eq!(estimate.estimated_total_usd, Some(12.0));
    }

    #[test]
    fn quota_estimate_handles_full_empty_fractional_and_large_costs() {
        let conn = database();
        insert(&conn, 1, NOW, Some(1_000_000_000_000_000));
        let full = estimate_from_window_start(&conn, 1, window(100.0), NOW)
            .unwrap()
            .unwrap();
        assert!(full.estimated_total_usd.is_none());
        let exhausted = estimate_from_window_start(&conn, 1, window(0.0), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(exhausted.estimated_total_usd, Some(1.0));
        assert_eq!(exhausted.estimated_remaining_usd, Some(0.0));
        let fractional = estimate_from_window_start(&conn, 1, window(99.5), NOW)
            .unwrap()
            .unwrap();
        assert_eq!(fractional.estimated_total_usd, Some(200.0));
        assert_eq!(fractional.estimated_remaining_usd, Some(199.0));
        insert(&conn, 2, NOW, Some(i64::MAX));
        insert(&conn, 2, NOW, Some(i64::MAX));
        let large = estimate_from_window_start(&conn, 2, window(50.0), NOW)
            .unwrap()
            .unwrap();
        assert!(large.estimated_total_usd.unwrap() > 30_000.0);
        insert(&conn, 3, NOW, Some(0));
        assert!(estimate_from_window_start(&conn, 3, window(50.0), NOW)
            .unwrap()
            .unwrap()
            .estimated_total_usd
            .is_none());
    }

    #[test]
    fn quota_estimate_rejects_missing_invalid_and_expired_windows() {
        let conn = database();
        for remaining in [f64::NAN, f64::INFINITY, -0.1, 100.1] {
            assert!(estimate_from_window_start(&conn, 1, window(remaining), NOW)
                .unwrap()
                .is_none());
        }
        for invalid in [
            OAuthQuotaWindow {
                remaining_percent: None,
                ..window(80.0)
            },
            OAuthQuotaWindow {
                reset_at: None,
                ..window(80.0)
            },
            OAuthQuotaWindow {
                reset_at: Some(NOW),
                ..window(80.0)
            },
            OAuthQuotaWindow {
                reset_at: Some(NOW - 1),
                ..window(80.0)
            },
            OAuthQuotaWindow {
                reset_at: Some(NOW + 6 * 3600),
                ..window(80.0)
            },
            OAuthQuotaWindow {
                duration_seconds: None,
                ..window(80.0)
            },
            OAuthQuotaWindow {
                duration_seconds: Some(0),
                ..window(80.0)
            },
            OAuthQuotaWindow {
                duration_seconds: Some(32 * 24 * 3600),
                ..window(80.0)
            },
        ] {
            assert!(estimate_from_window_start(&conn, 1, invalid, NOW)
                .unwrap()
                .is_none());
        }
        assert!(estimate_from_window_start(&conn, 0, window(80.0), NOW)
            .unwrap()
            .is_none());
        assert!(estimate_from_window_start(&conn, 1, window(80.0), -1)
            .unwrap()
            .is_none());
    }

    #[test]
    fn quota_estimate_propagates_database_errors() {
        let conn = Connection::open_in_memory().unwrap();
        assert!(estimate_from_window_start(&conn, 1, window(80.0), NOW).is_err());
    }
}
