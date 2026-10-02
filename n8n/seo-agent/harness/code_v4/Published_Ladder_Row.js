// The ladder row update when the published keyword belongs to a ladder (status published, real URL).
const r = $('Publish Check').first().json.ladder_row; return r ? [{ json: r }] : [{ json: { skip: true } }];
