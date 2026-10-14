// R17 (2026-10-14, system review FIX_PLAN 3.12): the run ledger reserves its row on the MAIN path now, before the first paid call -
// it used to hang off the plan node as a side branch and n8n's v1 order ran it last, after all the spending. A Data Table node answers with
// the row it wrote rather than with its input, so this node hands Watch Plan's own items back to the pipeline, unchanged and in order.
return $('Watch Plan').all();
