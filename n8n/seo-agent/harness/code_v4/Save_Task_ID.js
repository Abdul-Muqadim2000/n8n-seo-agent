const input = $('Normalize Input').first().json;
const res = $input.first().json;
const task = res.tasks && res.tasks[0];

if (!task || !task.id || task.status_code >= 40000) {
  throw new Error('Could not start site crawl: ' + (task ? task.status_message : 'no response'));
}

return [{ json: { ...input, crawl_task_id: task.id } }];