# NIP: Rollcall - Event Check-in System

## Abstract

This NIP defines a protocol for creating event "rooms" that enable hosts to manage attendance and allow participants to check-in by signing a message with their Nostr pubkey. The system is designed for applications such as issuing continuing education credits, participation certificates, or recording attendance.

## Motivation

In many educational, professional development, or organizational contexts, it's important to reliably track attendance. Traditional methods like paper sign-in sheets or centralized databases have limitations. Nostr provides an ideal architecture for creating a decentralized, cryptographically secure attendance verification system.

## Event Kinds

This NIP defines two new event kinds:

1. `31110` - Event Room (Addressable event):
   - Created by hosts to establish a check-in space
   - Identified by a unique `d` tag value
   - Contains metadata about the event

2. `1110` - Event Check-in (Regular event):
   - Created by participants to check in to an event
   - References the Event Room through an `a` tag
   - Serves as cryptographic proof of attendance

## Event Room (kind: 31110)

The Event Room event is created by a host to establish the check-in space. It contains metadata about the event and is an addressable event, so it can be updated by the host.

### Required Tags:
- `d`: A unique identifier for the event
- `title`: The title of the event
- `start`: Start time of the event (Unix timestamp as string)
- `end`: End time of the event (Unix timestamp as string)

### Optional Tags:
- `description`: A description of the event
- `location`: Physical or virtual location of the event
- `image`: URL to an image representing the event
- `website`: URL to a website with additional information
- `organizer`: Name of the organizing entity
- `category`: Event category (e.g., "education", "conference", "meeting")
- `credential`: Type of credential that will be issued (e.g., "certificate", "credit")
- `t`: Topic tags to categorize the event
- `req_fields`: Additional fields required for check-in (comma-separated list)

### Content Format:
The content field should contain additional information that doesn't fit in tags, or can be left empty.

## Event Check-in (kind: 1110)

The Check-in event is created by a participant to register attendance at an event.

### Required Tags:
- `a`: Reference to the Event Room event in the format `31110:<pubkey>:<d-tag-value>`
- `start`: Check-in time (Unix timestamp as string)

### Optional Tags:
- `location`: Location at check-in time if geolocation is enabled
- `name`: Real name of participant if different from Nostr profile
- `email`: Email address for receiving credentials
- `custom`: Additional fields as required by the event (in JSON format)

### Content Format:
The content field can contain a personal message or be left empty.

## Example Flow

1. A host creates an Event Room:
```json
{
  "kind": 31110,
  "content": "Join us for our monthly webinar on Nostr development!",
  "tags": [
    ["d", "monthly-webinar-2025-06"],
    ["title", "Nostr Development Webinar - June 2025"],
    ["start", "1719137400"],
    ["end", "1719144600"],
    ["description", "Learn about the latest advancements in Nostr protocol development"],
    ["location", "Virtual/Zoom"],
    ["website", "https://example.com/webinar"],
    ["organizer", "Nostr Developers Community"],
    ["category", "education"],
    ["credential", "certificate"],
    ["t", "nostr"],
    ["t", "development"],
    ["t", "webinar"],
    ["req_fields", "email"]
  ]
}
```

2. A participant checks in:
```json
{
  "kind": 1110,
  "content": "Excited to learn more about Nostr!",
  "tags": [
    ["a", "31110:1234...abc:monthly-webinar-2025-06"],
    ["start", "1719137520"],
    ["name", "Jane Smith"],
    ["email", "jane@example.com"]
  ]
}
```

3. The host can query all check-ins for their event using:
```
{
  "kinds": [1110],
  "#a": ["31110:1234...abc:monthly-webinar-2025-06"]
}
```

## Implementation Considerations

- Clients should validate that check-ins occur during the defined event window (between `start` and `end` tags of the Event Room)
- Hosts should be able to export attendance lists with relevant metadata for issuing credentials
- Privacy considerations should be implemented, such as optional encryption of certain fields like email addresses
- Check-in verification can be enhanced with additional factors like geolocation or PIN codes

## Extensions

Future extensions could include:
- Credential issuance directly through Nostr events
- Integration with verifiable credentials
- QR code-based check-in flow
- Automated attendance reporting