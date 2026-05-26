#!/bin/bash
set -e
cd /opt/simlab/backend
/opt/simlab/.venv/bin/python - <<'PY'
import sqlite3
conn = sqlite3.connect('sim_lab.db')
cur = conn.cursor()
for table in ('lab_works', 'projects', 'simulation_results'):
    cur.execute(f'SELECT COUNT(*) FROM {table}')
    print(table, cur.fetchone()[0])
conn.close()
PY
