-- Command Center Keyboard Shortcuts Setup Script
-- Run this in Script Editor or via osascript

-- This creates Automator quick actions that can be assigned keyboard shortcuts
-- Go to System Preferences > Keyboard > Shortcuts > Services after running

tell application "Automator"
    -- Note: Automator workflows need to be created manually or via Automator app
    -- This script provides instructions
end tell

display dialog "To set up keyboard shortcuts for Command Center:

1. Open Automator
2. Create 'Quick Action' workflows for:
   - Voice Memo: /usr/local/bin/cc voice 10
   - Screenshot: /usr/local/bin/cc screen
   - Quick Task: (with text input) /usr/local/bin/cc task \"$1\"

3. Save each as a Service
4. Go to System Preferences > Keyboard > Shortcuts > Services
5. Assign shortcuts like:
   - ⌃⌥V for Voice Memo
   - ⌃⌥S for Screenshot
   - ⌃⌥T for Quick Task

Or use the Alfred/Raycast workflows below." buttons {"OK"} default button "OK"
