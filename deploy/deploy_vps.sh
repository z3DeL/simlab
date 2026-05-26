#!/bin/bash
set -euo pipefail
apt-get update
apt-get install -y curl ca-certificates python3-pip python3-venv
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="/root/.local/bin:$PATH"
uv python install 3.11
rm -rf /opt/simlab
mkdir -p /opt/simlab
tar xzf /root/simlab-fullstate.tar.gz -C /opt/simlab
uv venv --python 3.11 --seed /opt/simlab/.venv
/opt/simlab/.venv/bin/python -m pip install --upgrade pip
/opt/simlab/.venv/bin/python -m pip install --no-cache-dir 'fastapi>=0.104' 'uvicorn[standard]>=0.24' 'sqlalchemy>=2.0' 'pydantic>=2.0' 'simpy>=4.1' 'gymnasium>=0.29' 'numpy>=1.24' 'httpx>=0.28'
/opt/simlab/.venv/bin/python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch
cp /opt/simlab/deploy/simlab.service /etc/systemd/system/simlab.service
systemctl daemon-reload
systemctl enable --now simlab
sleep 5
systemctl --no-pager --full status simlab | sed -n '1,20p'
curl -I http://127.0.0.1:8000 | head
