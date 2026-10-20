// F-ENG (2026-10-20): the next part of this morning's pulse (Pulse Plan's `pulse_next`: the websites after the last one this part took),
// started through the workflow's own Manual Run. None when every website was served.
const n = ($('AI Plan').first().json || {}).pulse_next;
return n && n.pulse_part ? [{ json: n }] : [{ json: { skip: true } }];