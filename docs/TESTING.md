
# Smoke Watch Testing Documentation

## 1. Testing Environment

- MacBook Air
- Node.js
- React + Vite
- Express Backend
- Local JSON Database
- Browser
- LINE Messaging API (when configured)

## 2. Test Cases

| Test ID | Test Description | Expected Result |
|---|---|---|
| TC01 | Open Dashboard | Dashboard loads |
| TC02 | Load detection data | Events appear |
| TC03 | Open Detection Logs | Event history appears |
| TC04 | Search Event ID | Matching events appear |
| TC05 | Filter by Camera | Matching camera events appear |
| TC06 | Open Statistics | Statistics are displayed |
| TC07 | Send valid AI JSON | Backend saves event |
| TC08 | Send duplicate event_id | Duplicate is not stored |
| TC09 | Send invalid JSON fields | Backend returns 400 |
| TC10 | Send invalid AI API key | Backend returns 401 when key is enabled |
| TC11 | Send heartbeat | System status becomes online |
| TC12 | Send LINE test message | LINE receives test message when configured |
| TC13 | Check evidence access | Unverified evidence URL is not exposed |
| TC14 | Stop Backend | Dashboard displays connection error |

## 3. Known Limitations

- Local JSON database is for prototype use.
- Camera and Jetson integration requires the hardware team.
- Face blur must be verified by the trusted AI pipeline.
- Automatic LINE alert conditions require team confirmation.
- Offline detection and evidence storage must be tested on the Edge device.

## 4. Test Result Record

Record each test as:
- PASS
- FAIL
- BLOCKED
- NOT TESTED

Include the test date, tester, and issue description.
