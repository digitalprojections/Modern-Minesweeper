from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
TOKEN_URI = "https://oauth2.googleapis.com/token"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD_ROOT = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"
TRACK_ALIASES = {
    "open-testing": "beta",
    "open_testing": "beta",
    "beta": "beta",
    "production": "production",
}


class PublisherError(RuntimeError):
    pass


@dataclass(frozen=True)
class ServiceAccount:
    client_email: str
    private_key: str
    token_uri: str = TOKEN_URI


def normalize_track(track: str) -> str:
    normalized = TRACK_ALIASES.get(track.strip().lower())
    if normalized is None:
        raise PublisherError("Only beta/open-testing and production publishing are supported by this helper.")
    return normalized


def load_service_account(path: Path | None) -> ServiceAccount:
    if path is not None:
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        env_value = os.environ.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "").strip()
        if not env_value:
            raise PublisherError("Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or pass --credentials with a service-account JSON file.")
        data = json.loads(env_value if env_value.startswith("{") else Path(env_value).read_text(encoding="utf-8"))

    try:
        return ServiceAccount(
            client_email=data["client_email"],
            private_key=data["private_key"],
            token_uri=data.get("token_uri", TOKEN_URI),
        )
    except KeyError as exc:
        raise PublisherError(f"Service account JSON is missing {exc.args[0]!r}.") from exc


def encode_urlsafe_json(payload: dict[str, Any]) -> bytes:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


def create_jwt(service_account: ServiceAccount, issued_at: int | None = None) -> str:
    now = int(time.time()) if issued_at is None else issued_at
    payload = {
        "iss": service_account.client_email,
        "scope": ANDROID_PUBLISHER_SCOPE,
        "aud": service_account.token_uri,
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = b".".join((encode_urlsafe_json({"alg": "RS256", "typ": "JWT"}), encode_urlsafe_json(payload)))
    private_key = serialization.load_pem_private_key(service_account.private_key.encode("utf-8"), password=None)
    signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    return ".".join((signing_input.decode("ascii"), base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")))


class HttpClient:
    def request_json(self, method: str, url: str, token: str | None = None, body: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        return self._open_json(request)

    def upload_file(self, method: str, url: str, token: str, path: Path, content_type: str) -> dict[str, Any]:
        request = urllib.request.Request(
            url,
            data=path.read_bytes(),
            headers={"Accept": "application/json", "Authorization": f"Bearer {token}", "Content-Type": content_type},
            method=method,
        )
        return self._open_json(request)

    def _open_json(self, request: urllib.request.Request) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                text = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise PublisherError(f"HTTP {exc.code} {request.full_url}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise PublisherError(f"Network error for {request.full_url}: {exc}") from exc
        return json.loads(text) if text.strip() else {}


class PlayPublisher:
    def __init__(self, http: HttpClient, package_name: str, token: str):
        self.http = http
        self.package_name = package_name
        self.token = token

    def create_edit(self) -> str:
        result = self.http.request_json("POST", f"{API_ROOT}/applications/{self.package_name}/edits", self.token, {})
        edit_id = result.get("id")
        if not edit_id:
            raise PublisherError(f"Android Publisher did not return an edit id: {result}")
        return edit_id

    def list_tracks(self, edit_id: str) -> dict[str, Any]:
        return self.http.request_json("GET", f"{API_ROOT}/applications/{self.package_name}/edits/{edit_id}/tracks", self.token)

    def upload_bundle(self, edit_id: str, aab_path: Path) -> int:
        result = self.http.upload_file(
            "POST",
            f"{UPLOAD_ROOT}/applications/{self.package_name}/edits/{edit_id}/bundles?uploadType=media",
            self.token,
            aab_path,
            "application/octet-stream",
        )
        if "versionCode" not in result:
            raise PublisherError(f"Bundle upload did not return versionCode: {result}")
        return int(result["versionCode"])

    def update_track(self, edit_id: str, track: str, version_code: int, release_name: str, status: str = "completed") -> dict[str, Any]:
        body = {"releases": [{"name": release_name, "versionCodes": [str(version_code)], "status": status}]}
        return self.http.request_json("PUT", f"{API_ROOT}/applications/{self.package_name}/edits/{edit_id}/tracks/{track}", self.token, body)

    def commit_edit(self, edit_id: str) -> dict[str, Any]:
        return self.http.request_json("POST", f"{API_ROOT}/applications/{self.package_name}/edits/{edit_id}:commit", self.token)


def request_access_token(http: HttpClient, service_account: ServiceAccount) -> str:
    body = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": create_jwt(service_account)}
    ).encode("utf-8")
    request = urllib.request.Request(
        service_account.token_uri,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    result = http._open_json(request)
    token = result.get("access_token")
    if not token:
        raise PublisherError(f"OAuth token response did not include access_token: {result}")
    return token


def inspect_tracks(http: HttpClient, service_account: ServiceAccount, package_name: str) -> dict[str, Any]:
    publisher = PlayPublisher(http, package_name, request_access_token(http, service_account))
    edit_id = publisher.create_edit()
    try:
        return publisher.list_tracks(edit_id)
    finally:
        publisher.commit_edit(edit_id)


def publish_bundle(
    http: HttpClient,
    service_account: ServiceAccount,
    package_name: str,
    aab_path: Path,
    track: str,
    release_name: str,
    release_status: str,
) -> dict[str, Any]:
    if not aab_path.exists():
        raise PublisherError(f"AAB not found: {aab_path}")
    normalized_track = normalize_track(track)
    publisher = PlayPublisher(http, package_name, request_access_token(http, service_account))
    edit_id = publisher.create_edit()
    version_code = publisher.upload_bundle(edit_id, aab_path)
    track_update = publisher.update_track(edit_id, normalized_track, version_code, release_name, release_status)
    commit_result = publisher.commit_edit(edit_id)
    readback_edit_id = publisher.create_edit()
    try:
        readback = publisher.list_tracks(readback_edit_id)
    finally:
        publisher.commit_edit(readback_edit_id)
    return {
        "packageName": package_name,
        "track": normalized_track,
        "versionCode": version_code,
        "trackUpdate": track_update,
        "commit": commit_result,
        "tracks": readback,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Publish Modern Minesweeper to Google Play.")
    parser.add_argument("--credentials", type=Path, help="Path to Play service-account JSON.")
    parser.add_argument("--package", default="link.created.minesweepermaui", dest="package_name")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("inspect", help="Read current Play tracks.")
    publish_parser = subparsers.add_parser("publish", help="Upload an AAB to Open Testing.")
    publish_parser.add_argument("--aab", required=True, type=Path)
    publish_parser.add_argument("--track", default="open-testing")
    publish_parser.add_argument("--release-name", default="Modern Minesweeper 1.0 (1)")
    publish_parser.add_argument("--status", default="completed", choices=("completed", "draft"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        http = HttpClient()
        service_account = load_service_account(args.credentials)
        if args.command == "inspect":
            result = inspect_tracks(http, service_account, args.package_name)
        else:
            result = publish_bundle(http, service_account, args.package_name, args.aab, args.track, args.release_name, args.status)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except PublisherError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
