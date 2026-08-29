import tempfile
import unittest
from pathlib import Path

from PIL import Image

import importlib.util


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "format-store-screenshot.py"


def load_formatter_module():
    spec = importlib.util.spec_from_file_location("format_store_screenshot", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class StoreScreenshotFormatterTest(unittest.TestCase):
    def test_exports_rgb_portrait_without_alpha(self):
        formatter = load_formatter_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "source.png"
            target = Path(temp_dir) / "target.png"
            Image.new("RGBA", (1080, 2280), (10, 20, 30, 128)).save(source)

            formatter.format_store_screenshot(source, target, 1080, 1920)

            with Image.open(target) as result:
                self.assertEqual((1080, 1920), result.size)
                self.assertEqual("RGB", result.mode)

    def test_exports_rgb_landscape_without_alpha(self):
        formatter = load_formatter_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "source.png"
            target = Path(temp_dir) / "target.png"
            Image.new("RGBA", (2280, 1080), (10, 20, 30, 128)).save(source)

            formatter.format_store_screenshot(source, target, 1920, 1080)

            with Image.open(target) as result:
                self.assertEqual((1920, 1080), result.size)
                self.assertEqual("RGB", result.mode)

    def test_can_crop_to_portrait_upload_shape(self):
        formatter = load_formatter_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "source.png"
            target = Path(temp_dir) / "target.png"
            Image.new("RGB", (1080, 2280), (10, 20, 30)).save(source)

            formatter.format_store_screenshot(source, target, 1080, 1920, "crop")

            with Image.open(target) as result:
                self.assertEqual((1080, 1920), result.size)
                self.assertEqual("RGB", result.mode)


if __name__ == "__main__":
    unittest.main()
