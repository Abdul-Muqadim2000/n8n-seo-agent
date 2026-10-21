// The run continues with the competitors Pick Top 6 chose (a Data Table upsert outputs the stored row, not the run's items).
return $('Pick Top 6').all().map(i => ({ json: i.json }));