import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class GlobalToolsTest(unittest.TestCase):
    def test_release_wrapper_uses_project_release_script(self):
        script = (ROOT / "tools" / "global" / "minesweeper-release-aab.ps1").read_text(encoding="utf-8")

        self.assertIn("Modern-Minesweeper", script)
        self.assertIn("scripts\\build-release-aab.ps1", script)
        self.assertIn("MINESWEEPER_PROJECT_ROOT", script)

    def test_open_testing_wrapper_uses_required_package_and_beta_track(self):
        script = (ROOT / "tools" / "global" / "minesweeper-open-testing.ps1").read_text(encoding="utf-8")

        self.assertIn('link.created.minesweepermaui', script)
        self.assertIn('scripts\\publish-open-testing.ps1', script)
        self.assertIn('$Track = "beta"', script)

    def test_cmd_shims_call_matching_powershell_scripts(self):
        for name in ("minesweeper-release-aab", "minesweeper-open-testing"):
            shim = (ROOT / "tools" / "global" / f"{name}.cmd").read_text(encoding="utf-8")
            self.assertIn(f'{name}.ps1', shim)
            self.assertIn("ExecutionPolicy Bypass", shim)

    def test_release_script_prefers_jdk_21_for_capacitor(self):
        script = (ROOT / "scripts" / "build-release-aab.ps1").read_text(encoding="utf-8")

        self.assertIn("Use-Jdk21IfAvailable", script)
        self.assertIn("C:\\Program Files\\Android\\openjdk\\jdk-21.0.8", script)
        self.assertIn("$env:JAVA_HOME", script)


if __name__ == "__main__":
    unittest.main()
