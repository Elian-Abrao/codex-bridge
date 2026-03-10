from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class CliE2ETests(unittest.TestCase):
    def test_status_command_runs_from_module_entrypoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            env = os.environ.copy()
            env["PYTHONPATH"] = str(REPO_ROOT / "src")
            env["CODEX_BRIDGE_DISABLE_KEYRING"] = "1"
            env["CODEX_BRIDGE_AUTH_STORE_PATH"] = str(Path(temp_dir) / "auth" / "session.json")

            result = subprocess.run(
                [sys.executable, "-m", "codex_bridge", "status"],
                cwd=REPO_ROOT,
                env=env,
                text=True,
                capture_output=True,
                check=True,
            )

            payload = json.loads(result.stdout)
            self.assertEqual(payload, {"isRefreshing": False})


if __name__ == "__main__":
    unittest.main()
