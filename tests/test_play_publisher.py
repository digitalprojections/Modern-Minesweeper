import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.play_publisher import API_ROOT, UPLOAD_ROOT, PlayPublisher, PublisherError, normalize_track


class FakeHttp:
    def __init__(self):
        self.requests = []
        self.uploads = []

    def request_json(self, method, url, token=None, body=None):
        self.requests.append((method, url, token, body))
        if url.endswith("/edits") and method == "POST":
            return {"id": "edit-1"}
        if url.endswith("/tracks/beta") and method == "PUT":
            return {"track": "beta", "releases": body["releases"]}
        if url.endswith(":commit") and method == "POST":
            return {"id": "edit-1"}
        if url.endswith("/tracks") and method == "GET":
            return {"tracks": [{"track": "beta", "releases": [{"versionCodes": ["1"]}]}]}
        return {}

    def upload_file(self, method, url, token, path, content_type):
        self.uploads.append((method, url, token, path, content_type))
        return {"versionCode": 2}


class PlayPublisherTest(unittest.TestCase):
    def test_normalize_track_allows_supported_release_tracks(self):
        self.assertEqual(normalize_track("open-testing"), "beta")
        self.assertEqual(normalize_track("open_testing"), "beta")
        self.assertEqual(normalize_track("beta"), "beta")
        self.assertEqual(normalize_track("production"), "production")
        with self.assertRaises(PublisherError):
            normalize_track("internal")

    def test_update_track_uses_beta_release_with_string_version_code(self):
        http = FakeHttp()
        publisher = PlayPublisher(http, "link.created.minesweepermaui", "token")

        result = publisher.update_track("edit-1", "beta", 2, "Modern Minesweeper 1.0 (2)")

        self.assertEqual(result["track"], "beta")
        self.assertEqual(
            http.requests[-1],
            (
                "PUT",
                f"{API_ROOT}/applications/link.created.minesweepermaui/edits/edit-1/tracks/beta",
                "token",
                {"releases": [{"name": "Modern Minesweeper 1.0 (2)", "versionCodes": ["2"], "status": "completed"}]},
            ),
        )

    def test_upload_bundle_uses_androidpublisher_media_endpoint(self):
        http = FakeHttp()
        publisher = PlayPublisher(http, "link.created.minesweepermaui", "token")
        with TemporaryDirectory() as temp_dir:
            aab = Path(temp_dir) / "app-release.aab"
            aab.write_bytes(b"bundle")

            version_code = publisher.upload_bundle("edit-1", aab)

        self.assertEqual(version_code, 2)
        self.assertEqual(
            http.uploads[-1][:3],
            (
                "POST",
                f"{UPLOAD_ROOT}/applications/link.created.minesweepermaui/edits/edit-1/bundles?uploadType=media",
                "token",
            ),
        )
        self.assertEqual(http.uploads[-1][4], "application/octet-stream")


if __name__ == "__main__":
    unittest.main()
