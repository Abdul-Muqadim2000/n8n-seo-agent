// harness shim (written by build_v4.py section 25): the IF node's condition, true = take the retry branch
return $input.all().map(i => { const $json = i.json; return { json: { retry: !!($json.error || Number($json.status_code) >= 50000 || Number((($json.tasks || [])[0] || {}).status_code) >= 50000) } }; });
