#!/usr/bin/env python3
"""R111 — the one-off repair of `seo_content_log` rows that say `written` for a page whose last quality round failed.

The rule lives in fix_not_ready_drafts.py (pure Python, never runs inside n8n), so its test lives here, beside test_fix_phantom_pages.py.
The live rows are the six of exec 632's *Load Content Log (Tracker)* (techand.ai, 2026-10-15): rows 5 and 6 are the two drafts the
re-rating saw fail; rows 3 and 4 passed and must stay `written`; rows 1 and 2 are `started`.

    python3 test_fix_not_ready_drafts.py          # or: python3 -m unittest test_fix_not_ready_drafts -v
"""
import os, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from fix_not_ready_drafts import judge, verdict, DOSSIER_FAILED, KEEP_WRITTEN   # noqa: E402

DOM = 'techand.ai'


def log(rid, keyword, status, request_id, **kw):
    r = {'id': rid, 'site_id': 'site_techand-ai', 'domain': DOM, 'keyword': keyword, 'source': 'ladder', 'page_type': 'Service Page',
         'existing_page_url': '', 'rung': 1, 'ladder_id': 'lad_x', 'request_id': request_id, 'started_at': '2026-10-15T19:22:58.287Z',
         'status': status, 'published_url': '', 'published_at': '', 'week': '2026-10-15'}
    r.update(kw)
    return r


LIVE = [log(1, 'e invoicing uae fta', 'started', 'cad_20261001_techand-ai_1'), log(2, 'peppol uae', 'started', '221'),
        log(3, 'erp software uae', 'written', '441'), log(4, 'service industry erp software', 'written', '520'),
        log(5, 'azure api management monetization', 'written', '548'), log(6, 'ai consulting', 'written', '609')]
EXEC_616 = verdict({'qa_not_ready': True, 'qa_reasons': ['it covers 60% of the terms the best-ranking page covers, against a target of 90%', 'External links to sources not in the evidence plan']},
                   '609', 'n8n execution 616 (2026-10-15T19:09:40)')


class NotReadyDrafts(unittest.TestCase):
    def ids(self, rows):
        return sorted(r['id'] for r, *_ in rows)

    def test_the_two_failed_drafts_are_marked_from_the_runs_own_verdict(self):
        mark, kept = judge(LIVE, {(DOM, 'ai consulting'): EXEC_616,
                                  (DOM, 'azure api management monetization'): verdict({'qa_not_ready': True, 'qa_reasons': ['the main content is 3,180 words against a target of 2,100']}, '548', 'n8n execution 554')})
        self.assertEqual(self.ids(mark), [5, 6])
        m6 = next(d for r, d, _w in mark if r['id'] == 6)
        self.assertEqual(m6['status'], 'not_ready')
        self.assertIn('60% of the terms', m6['qa_reasons'])
        self.assertIn('; ', m6['qa_reasons'])
        self.assertEqual(self.ids(kept), [3, 4])                       # rows 3 and 4 stay `written`; `started` rows are not even judged

    def test_with_the_executions_unreadable_only_the_dossier_record_is_used(self):
        mark, kept = judge(LIVE, None)
        self.assertEqual(self.ids(mark), [5, 6])
        self.assertTrue(all("could not be read" in w for _r, _d, w in mark))
        self.assertEqual(self.ids(kept), [3, 4])

    def test_rows_3_and_4_are_never_touched_whatever_the_evidence_says(self):
        bad = verdict({'qa_not_ready': True, 'qa_reasons': ['x']}, '441', 'n8n execution 999')
        mark, kept = judge(LIVE, {(DOM, 'erp software uae'): bad})
        self.assertNotIn(3, self.ids(mark))
        self.assertIn(3, self.ids(kept))

    def test_a_run_that_passed_keeps_the_row_written(self):
        passed = verdict({'qa_not_ready': False, 'qa_reasons': []}, '609', 'n8n execution 700')
        mark, kept = judge(LIVE, {(DOM, 'ai consulting'): passed})
        self.assertNotIn(6, self.ids(mark))
        self.assertTrue(any(r['id'] == 6 and 'passed' in w for r, w in kept))

    def test_a_verdict_of_another_run_is_not_evidence_for_this_row(self):
        other = verdict({'qa_not_ready': True, 'qa_reasons': ['x']}, '777', 'n8n execution 800')
        rows = [log(7, 'dynamics 365 crm uae', 'written', '640')]
        mark, kept = judge(rows, {(DOM, 'dynamics 365 crm uae'): other})
        self.assertEqual(mark, [])
        self.assertIn('no quality verdict', kept[0][1])

    def test_the_dossier_record_needs_the_recorded_run(self):
        rows = [log(6, 'ai consulting', 'written', '999')]             # a later rewrite of the same keyword: not the run the dossier saw
        mark, kept = judge(rows, {})
        self.assertEqual(mark, [])

    def test_published_started_and_already_marked_rows_are_never_touched(self):
        rows = [log(8, 'ai consulting', 'written', '609', published_url='https://www.techand.ai/ai-consulting/'), log(9, 'ai consulting', 'not_ready', '609'),
                log(10, 'peppol uae', 'started', '221'), log(11, 'azure api management monetization', 'published', '548')]
        mark, kept = judge(rows, None)
        self.assertEqual(mark, [])
        self.assertEqual(kept, [])

    def test_the_record_names_exactly_the_dossier_rows(self):
        self.assertEqual(sorted(k for _d, k in DOSSIER_FAILED), ['ai consulting', 'azure api management monetization'])
        self.assertEqual(sorted(k for _d, k in KEEP_WRITTEN), ['erp software uae', 'service industry erp software'])


if __name__ == '__main__':
    unittest.main()
