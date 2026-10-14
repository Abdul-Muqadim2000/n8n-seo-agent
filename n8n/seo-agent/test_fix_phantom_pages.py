#!/usr/bin/env python3
"""S64 — R1: a `writing` ladder row is only a phantom when nothing anywhere says a page exists.

The JS harness (`harness/scenarios_v5.js`) runs the workflows' Code nodes; this rule lives in `fix_phantom_pages.py`, which is pure
Python and never runs inside n8n, so its scenario lives here instead. It covers exactly the cases that made the first rule destructive
on the live tables (four real, unpublished pages flagged as phantoms, FIX_PLAN O9):

  1. a `writing` row with a `started` content-log row is NOT a phantom (a run happened; ladder pages were not logged before v4.14)
  2. a `writing` row with no log row at all but a finished page in the app's `reports` table is NOT a phantom
  3. a `writing` row with a `written` log row is NOT a phantom
  4. a `writing` row with a page run in n8n's executions is NOT a phantom (the only proof for the oldest pages)
  5. a `writing` row with genuinely nothing anywhere, started after ladder-page logging began, IS a phantom
  6. an unreachable evidence source (the app's reports, n8n's executions, the content log) yields a refusal, never a reset
  7. the date guard: a row that started before ladder-page logging, with nothing on record, is refused — and so is a row whose start
     date is older than the execution history
  8. the O9 pages are never touched, whatever the evidence says
  9. --mark-written proposes the smallest accurate change: the content log says `written`, the ladder row keeps `writing`

    python3 test_fix_phantom_pages.py          # or: python3 -m unittest test_fix_phantom_pages -v
"""
import os, sys, unittest
from unittest.mock import patch

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import fix_phantom_pages                                               # noqa: E402
from fix_phantom_pages import judge, mark_plan, LOG_SINCE, O9_PENDING   # noqa: E402

# The O9 name guard answers first, by design, so the evidence rule itself is exercised on keywords that are not on that list — and
# then, with the list emptied, on the four live rows, to prove the evidence alone (not the name) keeps them.
no_o9 = lambda: patch.dict(fix_phantom_pages.O9_PENDING, {}, clear=True)

DOM = 'techand.ai'
AFTER = '2026-10-13T06:00:00.000Z'     # after LOG_SINCE: the content log would hold the page
BEFORE = '2026-10-01T12:29:34.765Z'    # before LOG_SINCE: ladder pages were not logged yet
EXEC_OLDEST = '2026-10-01T06:11:00.180Z'


def lad(rid, keyword, start=AFTER, **kw):
    r = {'id': rid, 'ladder_id': 'lad_test', 'domain': DOM, 'keyword': keyword, 'rung': 2, 'page_no': 1, 'status': 'writing',
         'start_date': start, 'target_url': 'https://www.techand.ai/%s/' % keyword.replace(' ', '-'), 'page_exists': False,
         'published_url': '', 'page_type': 'Service Page'}
    r.update(kw)
    return r


def log(rid, keyword, status, started=AFTER, **kw):
    r = {'id': rid, 'site_id': 'site_techand-ai', 'domain': DOM, 'keyword': keyword, 'source': 'ladder', 'page_type': 'Guide',
         'existing_page_url': '', 'rung': 2, 'ladder_id': 'lad_test', 'request_id': 'req1', 'started_at': started, 'status': status,
         'published_url': '', 'published_at': '', 'week': started[:10]}
    r.update(kw)
    return r


def report(keyword, has_page=True, at='2026-10-13T07:00:00+00:00'):
    return {'id': 'a320fc57-0fc2-4987-bf49-1d3fbb0a3d26', 'domain': DOM, 'keyword': keyword, 'has_page': has_page,
            'status': 'completed', 'received_at': at}


def execs(by_key=None, oldest=EXEC_OLDEST):
    return {'by_key': dict(by_key or {}), 'oldest': oldest, 'count': 112}


def ev(pages=(), runs=(), refused=()):
    return {'pages': list(pages), 'runs': list(runs), 'refused': list(refused)}


def keyof(keyword):
    return (DOM, keyword)


class PhantomRule(unittest.TestCase):
    # ---- 1. a `started` log row is a run that happened: never a phantom -------------------------------------------------
    def test_started_log_row_is_not_a_phantom(self):
        rows = [lad(2, 'fta e invoice rules', BEFORE)]
        ph, kept = judge(rows, [log(1, 'fta e invoice rules', 'started', BEFORE)], [], execs({keyof('fta e invoice rules'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('says `started`', kept[0][1])
        self.assertIn('cannot be called a phantom', kept[0][1])

    # ---- 2. no log row, but the app received a finished page ------------------------------------------------------------
    def test_app_report_with_a_page_is_not_a_phantom(self):
        ph, kept = judge([lad(15, 'ap automation dynamics 365')], [], [report('ap automation dynamics 365')],
                         execs({keyof('ap automation dynamics 365'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('the app received a finished page', kept[0][1])

    def test_app_report_without_a_page_is_not_proof_either_way(self):
        """A `content` report with hasPage false is a report-only run: it neither proves nor disproves a page."""
        ph, kept = judge([lad(15, 'some keyword')], [], [report('some keyword', has_page=False)], execs({keyof('some keyword'): ev()}))
        self.assertEqual(len(ph), 1)                       # nothing anywhere knows of a page, and every source was readable
        self.assertIn('no finished page', ph[0][1])

    # ---- 3. a `written` log row ----------------------------------------------------------------------------------------
    def test_written_log_row_is_not_a_phantom(self):
        ph, kept = judge([lad(19, 'erp software for services')], [log(4, 'erp software for services', 'written')], [],
                         execs({keyof('erp software for services'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('says `written`', kept[0][1])

    # ---- 4. only n8n's executions know (the 2026-10-02 pages went to the test callback, before the app) ------------------
    def test_execution_that_wrote_a_page_is_not_a_phantom(self):
        ph, kept = judge([lad(1, 'e invoicing fines uae', BEFORE)], [], [],
                         execs({keyof('e invoicing fines uae'): ev(pages=['n8n execution 185 (2026-10-02) wrote the page'])}))
        self.assertEqual(ph, [])
        self.assertIn('execution 185', kept[0][1])

    # ---- 5. genuinely nothing, and the date guard is satisfied: a phantom ------------------------------------------------
    def test_nothing_anywhere_after_logging_began_is_a_phantom(self):
        row = lad(99, 'ghost keyword', AFTER)
        ph, kept = judge([row], [log(1, 'another keyword', 'written')], [report('another keyword')],
                         execs({keyof('ghost keyword'): ev(refused=['n8n execution 500 (2026-10-12) was refused before writing anything'])}))
        self.assertEqual(kept, [])
        self.assertEqual(len(ph), 1)
        self.assertEqual(ph[0][0]['id'], 99)
        self.assertIn('nothing anywhere says a page exists', ph[0][1])
        self.assertIn('execution 500', ph[0][1])

    def test_nothing_at_all_and_no_run_on_record_is_still_a_phantom_after_logging(self):
        ph, kept = judge([lad(99, 'ghost keyword', AFTER)], [], [], execs({keyof('ghost keyword'): ev()}))
        self.assertEqual(len(ph), 1)
        self.assertIn('no page run for this keyword', ph[0][1])

    # ---- 6. an unreachable source is a refusal, not a reset -------------------------------------------------------------
    def test_unreachable_app_reports_refuses(self):
        ph, kept = judge([lad(99, 'ghost keyword')], [], None, execs({keyof('ghost keyword'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn("app's reports table could not be read", kept[0][1])
        self.assertIn('nothing is called a phantom on a partial reading', kept[0][1])

    def test_unreachable_executions_refuses(self):
        ph, kept = judge([lad(99, 'ghost keyword')], [], [], None)
        self.assertEqual(ph, [])
        self.assertIn("n8n's executions could not be read", kept[0][1])

    def test_unreachable_content_log_refuses(self):
        ph, kept = judge([lad(99, 'ghost keyword')], None, [], execs({keyof('ghost keyword'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('could not be read', kept[0][1])

    # ---- 7. the date guards --------------------------------------------------------------------------------------------
    def test_row_older_than_ladder_page_logging_is_refused(self):
        ph, kept = judge([lad(1, 'ghost keyword', BEFORE)], [], [], execs({keyof('ghost keyword'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('before ladder pages were logged', kept[0][1])
        self.assertIn(LOG_SINCE[:10], kept[0][1])

    def test_row_older_than_the_execution_history_is_refused(self):
        ph, kept = judge([lad(1, 'ghost keyword', '2026-09-01T00:00:00Z')], [], [], execs({keyof('ghost keyword'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('execution history only reaches back to', kept[0][1])

    def test_row_with_no_readable_start_date_is_refused(self):
        ph, kept = judge([lad(1, 'ghost keyword', '')], [], [], execs({keyof('ghost keyword'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('no readable start_date', kept[0][1])

    def test_pre_logging_row_with_a_refused_run_on_record_is_a_phantom(self):
        """The content log cannot judge a pre-v4.14 row alone — but a run on record that wrote nothing can."""
        ph, kept = judge([lad(1, 'ghost keyword', BEFORE)], [], [],
                         execs({keyof('ghost keyword'): ev(refused=['n8n execution 31 (2026-10-01) was refused before writing anything'])}))
        self.assertEqual(len(ph), 1)
        self.assertIn('execution 31', ph[0][1])

    # ---- 8. the O9 pages ------------------------------------------------------------------------------------------------
    def test_o9_pages_are_never_touched_even_with_no_evidence_left(self):
        """Every guard off except the name: nothing on record, started after logging began, every source readable."""
        rows = [lad(i + 1, kw, AFTER) for i, kw in enumerate(sorted(O9_PENDING))]
        ph, kept = judge(rows, [], [], execs({keyof(kw): ev() for kw in O9_PENDING}))
        self.assertEqual(ph, [])
        self.assertEqual(len(kept), len(O9_PENDING))
        for _r, why, _p in kept:
            self.assertIn('FIX_PLAN O9', why)
        with no_o9():                                     # without the name guard these same rows would be reset
            ph2, _k = judge(rows, [], [], execs({keyof(kw): ev() for kw in O9_PENDING}))
        self.assertEqual(len(ph2), len(O9_PENDING))

    def test_an_o9_page_with_evidence_is_kept_on_its_evidence_and_still_says_o9(self):
        kw = 'peppol uae'
        ph, kept = judge([lad(10, kw, BEFORE)], [log(2, kw, 'started', BEFORE)], [report(kw)],
                         execs({keyof(kw): ev(pages=['n8n execution 222 (2026-10-08) wrote the page'])}))
        self.assertEqual(ph, [])
        why, proofs = kept[0][1], kept[0][2]
        self.assertIn('the app received a finished page', why)   # a page proof leads, so --mark-written can act on it
        self.assertTrue(any('execution 222' in p for p in proofs))
        self.assertTrue(any('FIX_PLAN O9' in p for p in proofs))
        self.assertTrue(any('says `started`' in p for p in proofs))

    def test_the_four_live_rows_are_kept_on_their_evidence_alone(self):
        """The live reading of 2026-10-14: the first rule flagged all four. With the O9 name guard switched off, so that only the
        evidence speaks, the new rule still keeps all four — each on a different source."""
        rows = [lad(1, 'uae e invoicing penalties', BEFORE), lad(2, 'e invoicing uae fta', BEFORE),
                lad(10, 'peppol uae', '2026-10-08T05:57:07.063Z'), lad(15, 'vendor invoice automation dynamics 365', '2026-10-12T06:46:09.907Z')]
        logs = [log(1, 'e invoicing uae fta', 'started', BEFORE), log(2, 'peppol uae', 'started', '2026-10-08T06:01:23.838Z')]
        reps = [report('uae e invoicing penalties', at='2026-10-02T22:22:23+00:00'), report('peppol uae', at='2026-10-08T06:10:35+00:00'),
                report('vendor invoice automation dynamics 365', at='2026-10-12T06:58:58+00:00')]
        xs = execs({keyof('uae e invoicing penalties'): ev(pages=['n8n execution 185 (2026-10-02) wrote the page']),
                    keyof('e invoicing uae fta'): ev(pages=['n8n execution 85 (2026-10-02) wrote the page']),
                    keyof('peppol uae'): ev(pages=['n8n execution 222 (2026-10-08) wrote the page']),
                    keyof('vendor invoice automation dynamics 365'): ev(pages=['n8n execution 430 (2026-10-12) wrote the page'])})
        with no_o9():
            ph, kept = judge(rows, logs, reps, xs)
        self.assertEqual(ph, [])
        self.assertEqual(len(kept), 4)
        for _r, why, _p in kept:
            self.assertNotIn('O9', why)                  # the evidence, not the name, is what saved them

    def test_the_four_live_rows_would_have_been_flagged_by_the_old_rule(self):
        """The rule this script was born with: `writing` and no `written` log row. All four live rows fail it — which is the bug."""
        rows = [lad(1, 'uae e invoicing penalties', BEFORE), lad(2, 'e invoicing uae fta', BEFORE),
                lad(10, 'peppol uae', '2026-10-08T05:57:07.063Z'), lad(15, 'vendor invoice automation dynamics 365', '2026-10-12T06:46:09.907Z')]
        logs = [log(1, 'e invoicing uae fta', 'started', BEFORE), log(2, 'peppol uae', 'started', '2026-10-08T06:01:23.838Z')]
        old = [r for r in rows if not any(l['keyword'] == r['keyword'] and l['status'] in ('written', 'published') for l in logs)]
        self.assertEqual(len(old), 4)

    # ---- the other keeps -----------------------------------------------------------------------------------------------
    def test_published_url_and_existing_page_are_kept(self):
        rows = [lad(5, 'kw a', published_url='https://www.techand.ai/a/'), lad(6, 'kw b', page_exists=True)]
        ph, kept = judge(rows, [], [], execs({keyof('kw a'): ev(), keyof('kw b'): ev()}))
        self.assertEqual(ph, [])
        self.assertIn('published URL', kept[0][1])
        self.assertIn('page_exists', kept[1][1])

    def test_filters_and_non_writing_rows(self):
        rows = [lad(1, 'kw a'), dict(lad(2, 'kw b'), status='planned'), dict(lad(3, 'kw c'), domain='other.com')]
        ph, kept = judge(rows, [], [], execs({keyof('kw a'): ev(), ('other.com', 'kw c'): ev()}), domain=DOM)
        self.assertEqual([r['id'] for r, _w, _p in ph], [1])
        ph2, _k = judge(rows, [], [], execs({keyof('kw a'): ev()}), ladder_id='nope')
        self.assertEqual(ph2, [])


class HonestStatus(unittest.TestCase):
    # ---- 9. --mark-written ---------------------------------------------------------------------------------------------
    def test_mark_written_backfills_the_log_and_leaves_the_ladder_row_writing(self):
        row = lad(1, 'uae e invoicing penalties', BEFORE)
        proof = 'n8n execution 185 (2026-10-02T14:39:09.064Z) wrote the page'   # the evidence carries the run's own timestamp
        kept = [(row, proof, [proof])]
        plans = mark_plan(kept, [])
        self.assertEqual(len(plans), 1)
        p = plans[0]
        self.assertEqual(p['log']['status'], 'written')
        self.assertEqual(p['log']['keyword'], 'uae e invoicing penalties')
        self.assertEqual(p['log']['site_id'], 'site_techand-ai')
        self.assertEqual(p['log']['ladder_id'], 'lad_test')
        self.assertEqual(p['log']['request_id'], '185')                  # the proof's own id
        self.assertEqual(p['log']['started_at'], '2026-10-02T14:39:09.064Z')   # the day the page was written, not today
        self.assertEqual(p['log']['week'], '2026-10-02')
        self.assertEqual(p['log']['published_url'], '')                  # nothing is live
        self.assertEqual(p['log']['published_at'], '')
        self.assertIsNone(p['exists'])                                   # an insert: this page was never logged
        self.assertIn('awaiting the owner', p['note'])
        self.assertIn('FIX_PLAN O9', p['note'])
        self.assertIn('refresh the live /insights article', p['note'])   # O9's instruction for this very page
        self.assertIn(row['target_url'], p['note'])
        self.assertLessEqual(len(p['note']), 480)
        # the ladder row itself is only ever given a note: the plan carries no new ladder status (`writing` is already right)
        self.assertEqual(sorted(p), ['exists', 'log', 'note', 'proofs', 'row'])
        self.assertEqual(p['row']['status'], 'writing')

    def test_mark_written_upgrades_an_existing_started_row_and_keeps_its_run(self):
        row = lad(2, 'e invoicing uae fta', BEFORE)
        existing = log(1, 'e invoicing uae fta', 'started', BEFORE, request_id='cad_20261001_techand-ai_1', page_type='Guide')
        kept = [(row, 'n8n execution 85 (2026-10-02T05:57:30.112Z) wrote the page',
                 ['n8n execution 85 (2026-10-02T05:57:30.112Z) wrote the page',
                  'seo_content_log row 1 says `started` — a page run was started for it'])]
        plans = mark_plan(kept, [existing])
        self.assertEqual(len(plans), 1)
        p = plans[0]
        self.assertEqual(p['exists']['id'], 1)                           # an update of the row the run opened
        self.assertEqual(p['log']['status'], 'written')
        self.assertEqual(p['log']['request_id'], 'cad_20261001_techand-ai_1')
        self.assertEqual(p['log']['started_at'], BEFORE)
        self.assertEqual(p['log']['page_type'], 'Guide')
        self.assertEqual(p['log']['source'], 'ladder')

    def test_mark_written_skips_rows_whose_page_is_not_proven(self):
        row = lad(9, 'ghost keyword')
        kept = [(row, 'seo_content_log row 7 says `started` — a page run was started for it',
                 ['seo_content_log row 7 says `started` — a page run was started for it'])]
        self.assertEqual(mark_plan(kept, []), [])

    def test_mark_written_skips_a_row_the_log_already_calls_written(self):
        row = lad(19, 'service industry erp software')
        kept = [(row, 'seo_content_log row 4 says `written`', ['seo_content_log row 4 says `written`'])]
        self.assertEqual(mark_plan(kept, [log(4, 'service industry erp software', 'written')]), [])

    def test_mark_written_only_writes_the_content_log_columns(self):
        from ladder_common import LOG_COLS
        row = lad(15, 'vendor invoice automation dynamics 365', '2026-10-12T06:46:09.907Z')
        proof = 'the app received a finished page for it (report 53e7b80f, 2026-10-12T06:58:58.120Z)'
        kept = [(row, proof, [proof])]
        p = mark_plan(kept, [])[0]
        self.assertEqual(sorted(p['log']), sorted(c for c, _t in LOG_COLS))
        self.assertEqual(p['log']['request_id'], '53e7b80f')
        self.assertEqual(p['log']['started_at'], '2026-10-12T06:58:58.120Z')


if __name__ == '__main__':
    unittest.main(verbosity=2)
