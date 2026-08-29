import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "make-splash-icon.py"


def load_splash_module():
    spec = importlib.util.spec_from_file_location("make_splash_icon", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class SplashIconTest(unittest.TestCase):
    def test_generates_centered_transparent_padding(self):
        module = load_splash_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            source = temp_path / "source.png"
            target = temp_path / "splash_icon.png"
            Image.new("RGBA", (512, 512), (255, 128, 0, 255)).save(source)

            module.make_padded_splash_icon(source, target)

            result = Image.open(target).convert("RGBA")
            self.assertEqual((768, 768), result.size)
            self.assertEqual((0, 0, 0, 0), result.getpixel((0, 0)))
            self.assertEqual((255, 128, 0, 255), result.getpixel((384, 384)))
            self.assertEqual((255, 128, 0, 255), result.getpixel((384, 156)))
            self.assertEqual((255, 128, 0, 255), result.getpixel((156, 384)))
            self.assertEqual((255, 128, 0, 255), result.getpixel((611, 384)))
            self.assertEqual((0, 0, 0, 0), result.getpixel((140, 384)))
            self.assertEqual((0, 0, 0, 0), result.getpixel((156, 156)))


if __name__ == "__main__":
    unittest.main()
