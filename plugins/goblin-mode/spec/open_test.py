from pathlib import Path
import importlib.util
import subprocess
import unittest
from unittest.mock import Mock, patch

script = Path(__file__).parents[1] / 'skills/help-me-get-started/scripts/show_explainer.py'
spec = importlib.util.spec_from_file_location('explainer', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class OpenTest(unittest.TestCase):
    def test_platform_openers(self):
        path = Path('/tmp/A & %NAME%.html')
        for platform in ['linux', 'darwin']:
            with patch.object(module.sys, 'platform', platform), patch.object(module.subprocess, 'Popen') as launch:
                launch.side_effect = [Mock(wait=Mock(return_value=1)), Mock(wait=Mock(return_value=0))]
                module.open_in_browser(path)
                self.assertEqual(launch.call_count, 2)
                for args, kwargs in launch.call_args_list:
                    self.assertEqual(args[0][-1], str(path))
                    self.assertEqual(kwargs['stdin'], subprocess.DEVNULL)
                    self.assertEqual(kwargs['stdout'], subprocess.DEVNULL)
                    self.assertEqual(kwargs['stderr'], subprocess.DEVNULL)
                    self.assertTrue(kwargs['start_new_session'])
                launch.side_effect = OSError('missing')
                with self.assertRaises(RuntimeError):
                    module.open_in_browser(path)
                launch.side_effect = None
                launch.return_value.wait.side_effect = subprocess.TimeoutExpired('browser', 1)
                module.open_in_browser(path)
        with patch.object(module.sys, 'platform', 'win32'), patch.object(module.os, 'startfile', create=True) as launch:
            module.open_in_browser(path)
            launch.assert_called_once_with(str(path))
            launch.side_effect = OSError('no association')
            with self.assertRaises(OSError):
                module.open_in_browser(path)

if __name__ == '__main__':
    unittest.main()
