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
    def _run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        env = os.environ.copy()
        env["PYTHONPATH"] = str(REPO_ROOT / "src")
        env["CODEX_BRIDGE_DISABLE_KEYRING"] = "1"
        env["CODEX_BRIDGE_AUTH_STORE_PATH"] = str(Path(temp_dir.name) / "auth" / "session.json")
        return subprocess.run(
            [sys.executable, "-m", "codex_bridge", *args],
            cwd=REPO_ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=True,
        )

    def test_status_command_runs_from_module_entrypoint(self) -> None:
        result = self._run_cli("--json", "status")
        payload = json.loads(result.stdout)
        self.assertEqual(payload, {"isRefreshing": False})

    def test_whoami_reports_unauthenticated_state(self) -> None:
        result = self._run_cli("--json", "whoami")
        payload = json.loads(result.stdout)
        self.assertEqual(payload["authenticated"], False)
        self.assertEqual(payload["provider"], "codex")

    def test_doctor_outputs_structured_report(self) -> None:
        result = self._run_cli("--json", "doctor")
        payload = json.loads(result.stdout)
        self.assertEqual(payload["service"], "codex-bridge")
        self.assertEqual(payload["auth"]["authenticated"], False)
        self.assertIn("authStorePath", payload["config"])

    def test_version_command_prints_package_version(self) -> None:
        result = self._run_cli("version")
        self.assertIn("codex-bridge", result.stdout)


if __name__ == "__main__":
    unittest.main()
