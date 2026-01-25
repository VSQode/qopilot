# Qopilot Tool Test Plan

After reload, immediately run these tests:

## Test 1: qopilot_execute_command
Call with: `{ "command": "workbench.action.showCommands" }`
Expected: Opens command palette

## Test 2: qopilot_attach_file  
Call with: `{ "path": "c:/www/VGM9/monorepos/as-cast/.__DOQ__/AS/DEQ_OF_QARDS/_/cards/8.♠.peanuts._/_/images/2026-01-24T17-46Z/rotations/rotated_0deg.jpg" }`
Expected: Image data returned, I can see the card

## Test 3: RAAS Rotation Analysis
Attach all 4 rotations:
- rotated_0deg.jpg
- rotated_90deg_cw.jpg
- rotated_180deg.jpg
- rotated_270deg_cw.jpg

Analyze what's visible at each orientation.
