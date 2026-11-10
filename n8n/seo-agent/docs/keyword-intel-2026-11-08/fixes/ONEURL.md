# KI-ONEURL: keyword research's page follows the ladder rules (2026-11-11)

## Why
The ladder package (LADDER.md) made the ladders follow "one search, one address" and never use a "-2" / "-copy" page; keyword research chose
the page for each cluster without those rules. On production this is the same mistake the repair had to undo by hand (LADDER_REPAIR.md):
techand.ai's CRM main page on /dynamics-365-crm-uae-2 (a copy of the live CRM page), three ERP rungs on one blog address.

## What changed (`_ki.js` KI.pageAction, with the ladder kit LRU inlined in Research Result)
- a "-2" / "-copy" variant of a live page (LRU.copyOf, titles compared) is never the page: the original is improved and the copy is to be
  redirected to it;
- the plan passes the addresses the ladders hold and the search each holds them for (`ladder_owners`; set aside, merged, stopped, failed and
  archived pages hold nothing); the clusters take their pages in score order and each kept page is added to the owners;
- an address another search holds (LRU.ownerOf; the same search in other words may always improve it) is not taken again, except:
  the page already ranks for this search (LRU.ranksFor: position 30 or better, or 10+ impressions) -> it stays there, marked shared;
  a ladder's buyer page and this buyer's search (both compare / hire) -> work it into that page, not a second page that would compete;
  otherwise the search gets a page of its own, with the reason ("already belongs to your keyword ladder for ...: one search, one page").
  The "lists and directories" advice is kept when the page is held.

## Tests
KIO-1..7 (scenarios_ki_e2.js) on the production shapes: the copy, the ladder's buyer page, a guide on the same page, a page that ranks, the
stronger cluster, the same search reordered, nothing changed for an unheld page, the wiring. Harness 18829 / 0.
