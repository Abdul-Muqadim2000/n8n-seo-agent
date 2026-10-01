"""Shared definitions for the keyword-ladder feature (used by build_v4.py and build_ladder_extras.py)."""
LADDER_TABLE = 'seo_ladders'
HISTORY_TABLE = 'seo_rank_history'
LADDER_COLS = [('ladder_id', 'string'), ('domain', 'string'), ('head_keyword', 'string'), ('rung', 'number'), ('page_no', 'number'), ('keyword', 'string'),
               ('supporting', 'string'), ('page_type', 'string'), ('target_url', 'string'), ('page_exists', 'boolean'), ('status', 'string'), ('months', 'string'),
               ('start_date', 'string'), ('country', 'string'), ('location_code', 'number'), ('language_code', 'string'), ('email', 'string'), ('callback_url', 'string'), ('request_id', 'string')]
HISTORY_COLS = [('ladder_id', 'string'), ('keyword', 'string'), ('checked_at', 'string'), ('position', 'number'), ('url', 'string'), ('serp_features', 'string'), ('domain', 'string'), ('rung', 'number')]
DT_TYPE, DT_VERSION = 'n8n-nodes-base.dataTable', 1.1

def dt_schema(cols):
    return [{'id': c, 'displayName': c, 'required': False, 'defaultMatch': False, 'display': True, 'type': t, 'canBeUsedToMatch': True, 'removed': False} for c, t in cols]
def dt_create_params(table, cols):
    """Create the table if it does not exist (returns the existing one otherwise) — self-healing setup, no UI step."""
    return {'resource': 'table', 'operation': 'create', 'tableName': table, 'columns': {'column': [{'name': c, 'type': t} for c, t in cols]}, 'options': {'createIfNotExists': True}}
def dt_insert_params(table, cols):
    return {'resource': 'row', 'operation': 'insert', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table},
            'columns': {'mappingMode': 'autoMapInputData', 'value': None, 'matchingColumns': [], 'schema': dt_schema(cols), 'attemptToConvertTypes': True, 'convertFieldsToString': False}, 'options': {}}
def dt_get_all_params(table):
    return {'resource': 'row', 'operation': 'get', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'returnAll': True, 'options': {}}
