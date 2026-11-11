
# Smoke Watch API Documentation

## 1. Project Overview

Smoke Watch is a smoking detection monitoring system.
The Backend receives detection events from the AI and Edge system,
stores event information, and provides data to the Dashboard.

## 2. Backend Base URL

Local development:

http://localhost:3000/api

## 3. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Backend health check (outside /api prefix) |
| POST | /webhook/detection | Receive AI detection event |
| GET | /detections | Get detection history |
| GET | /detections/:eventId | Get one event |
| GET | /statistics | Get detection statistics |
| GET | /system/status | Get system status |
| POST | /system/heartbeat | Update device heartbeat |
| POST | /notifications/test | Send LINE test message |

## 4. Detection Event JSON

The following JSON is a proposed integration contract.
AI Engineer and Backend Engineer must confirm all fields.

    {
      "event_id": "EVT-001",
      "timestamp": "2026-11-11T14:30:00Z",
      "event_type": "smoking",
      "confidence": 0.95,
      "camera_id": "CAM-01",
      "camera_name": "Building A",
      "evidence_url": "https://example.com/evidence/EVT-001.jpg",
      "face_blurred": true,
      "smoke_mandatory_gate": true,
      "notification_status": "pending"
    }

## 5. Required Fields

- event_id: Unique event identifier
- timestamp: Detection date and time
- event_type: Detection event type
- confidence: AI confidence between 0 and 1
- camera_id: Camera identifier
- face_blurred: Face blur processing status
- smoke_mandatory_gate: Gate evaluation result

## 6. Backend Behavior

- Validate required fields.
- Validate timestamp and confidence.
- Reject duplicate event_id values from being stored twice.
- Save detection events to the local JSON database.
- Provide detection data to the Dashboard.
- Do not expose evidence URLs in the current prototype.
- Determine notification status on the Backend.

## 7. Dashboard Data Refresh

The Dashboard requests updated data approximately every 5 seconds.

## 8. Security Notes

- LINE Channel Access Token must remain in backend/.env.
- Never expose secrets in frontend environment variables.
- Configure AI_WEBHOOK_KEY before real integration.
- Evidence images must be verified as face-blurred before access is provided.
- The current JSON database is a prototype, not production storage.

## 9. Integration Decisions Pending

- Confirm event_type values.
- Confirm timestamp timezone.
- Confirm Smoke-Mandatory Gate meaning.
- Confirm trusted face-blur verification.
- Confirm evidence storage location.
- Confirm automatic LINE notification conditions.
