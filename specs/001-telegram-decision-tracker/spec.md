# Feature Specification: Telegram Project Decision Tracker

**Feature Branch**: `001-telegram-decision-tracker`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Build an application that helps homeowners and contractors gather the missing project details from telegram group conversations. Text messages are extracted on a recurring cadence and are normalized based on pre-determined google sheet templates. Key decisions about the next project requirements like paint colors and such are documented into the template to help contractors stay on top of the project, make less constly mistakes, keep track of a decision log and better communicate with homeowners as well as reach deadlines."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contractor Reviews Extracted Decisions (Priority: P1)

A contractor opens the app and sees a structured list of decisions that have been automatically extracted from their Telegram project group — things like "paint color: Benjamin Moore Chantilly Lace" or "tile size: 12x24". They confirm or correct each decision, and confirmed decisions are written into the appropriate fields of the linked Google Sheet template.

**Why this priority**: This is the core value loop — without this, no other story delivers value. A contractor who can review and confirm decisions in one place avoids misreading buried messages and eliminates manual copy-paste into the sheet.

**Independent Test**: Can be tested by seeding a Telegram group with sample project messages, running the extractor, and verifying that the review screen presents correct decision candidates that can be confirmed and written to the sheet.

**Acceptance Scenarios**:

1. **Given** a project with a connected Telegram group and Google Sheet, **When** the contractor opens the decisions review screen, **Then** they see a list of extracted decisions grouped by template category with the originating message quoted.
2. **Given** an extracted decision is displayed, **When** the contractor confirms it, **Then** the corresponding Google Sheet field is updated and the decision is added to the decision log.
3. **Given** an extracted decision is incorrect, **When** the contractor edits and confirms it, **Then** the corrected value is written to the sheet and the log records both the original extraction and the correction.
4. **Given** no new decisions have been extracted since last review, **When** the contractor opens the screen, **Then** they see a "no pending decisions" state with the last-checked timestamp.

---

### User Story 2 - Automatic Message Extraction on Recurring Schedule (Priority: P2)

The system runs on its own, polling the connected Telegram group at a configured interval and processing new messages since the last run. Decision candidates are queued for contractor review without any manual trigger.

**Why this priority**: The recurring extraction is what separates this tool from manual review. Without it, contractors still have to remember to run the process themselves. Automating this cadence removes the cognitive overhead.

**Independent Test**: Can be tested by configuring a polling interval, posting new messages to the Telegram group, waiting one cycle, and verifying the decision queue receives new candidates.

**Acceptance Scenarios**:

1. **Given** a project with a configured polling interval, **When** the interval elapses, **Then** the system fetches all new messages from the Telegram group since the previous run.
2. **Given** new messages are fetched, **When** processing completes, **Then** any identified decision candidates appear in the contractor's pending review queue.
3. **Given** the Telegram group is unreachable during a poll, **When** the next successful poll runs, **Then** no messages are skipped — the system resumes from the last successfully processed message.
4. **Given** a poll cycle runs and contains no decision-relevant content, **When** the cycle completes, **Then** the queue is unchanged and the last-checked timestamp is updated.

---

### User Story 3 - Missing Decision Detection and Deadline Alerts (Priority: P3)

The app surfaces which Google Sheet template fields are still empty as a project progresses, and alerts the contractor when a deadline is approaching with required fields still unfilled. This helps contractors proactively prompt homeowners for outstanding decisions before they become blockers.

**Why this priority**: Knowing what is missing is as important as capturing what is known. Deadline-aware gap detection prevents last-minute scrambles and costly change orders.

**Independent Test**: Can be tested by creating a project with a partially filled template and an upcoming deadline, and verifying that the app shows the unfilled required fields and surfaces an alert when the deadline is within the configured warning window.

**Acceptance Scenarios**:

1. **Given** a project template with some fields unfilled, **When** the contractor views the project dashboard, **Then** they see a clear list of missing required fields grouped by project phase.
2. **Given** a deadline is configured for a project phase, **When** the deadline is within the alert window and required fields for that phase are still empty, **Then** the contractor receives a notification identifying the specific missing fields and the deadline date.
3. **Given** a previously missing field is filled through decision confirmation, **When** the contractor views the missing fields list, **Then** that field no longer appears as missing.

---

### User Story 4 - Decision Log and Audit Trail (Priority: P4)

A contractor needs to recall why a specific decision was made — for example, to resolve a dispute with a homeowner about a chosen material. They open the decision log for a project and see every confirmed decision with the source message, sender name, message timestamp, and the date it was confirmed.

**Why this priority**: The decision log is the trust layer. When homeowners dispute decisions, the contractor can show the exact Telegram message where the choice was agreed upon, protecting both parties.

**Independent Test**: Can be tested by confirming several decisions across different days, then opening the decision log and verifying each entry shows correct source message, sender, and confirmation metadata.

**Acceptance Scenarios**:

1. **Given** a project with confirmed decisions, **When** the contractor opens the decision log, **Then** they see a chronological list of all confirmed decisions with source message text, sender, original timestamp, and confirmation date.
2. **Given** a decision was corrected during review, **When** the contractor views that log entry, **Then** the entry shows both the originally extracted value and the corrected value.
3. **Given** the contractor filters the log by category (e.g., "paint"), **When** the filter is applied, **Then** only decisions matching that category are shown.

---

### User Story 5 - Project Setup and Template Linking (Priority: P5)

A contractor onboards a new project by entering its name, linking the corresponding Telegram group, connecting the target Google Sheet, and selecting the sheet template structure to use. Once set up, the project is live and extraction begins at the next scheduled poll.

**Why this priority**: Project setup is a one-time prerequisite — it does not deliver recurring value but is the entry point for everything else. Placed last because setup complexity should not block delivery of the core extraction loop.

**Independent Test**: Can be tested end-to-end by creating a project, linking a test Telegram group and Google Sheet, and verifying that the first poll cycle runs and that the sheet connection is validated.

**Acceptance Scenarios**:

1. **Given** a contractor begins project setup, **When** they submit the Telegram group identifier, **Then** the system validates that it has read access and confirms the connection.
2. **Given** a Telegram group is connected, **When** the contractor links a Google Sheet and selects a template, **Then** the system validates write access to the sheet and maps template fields to decision categories.
3. **Given** a project is fully configured, **When** setup is saved, **Then** the project appears in the contractor's project list and the first extraction poll is scheduled.

---

### Edge Cases

- What happens when a single Telegram message contains multiple distinct decisions (e.g., "paint is white and tile is marble")?
- How does the system handle messages that contradict an already-confirmed decision (e.g., "actually, let's change the paint color")?
- What happens when a Google Sheet template field is updated or renamed after a project has started?
- How does the system handle non-text messages in the Telegram group (photos, voice notes, documents)?
- What happens when the Google Sheet write fails partway through a batch of confirmed decisions?
- How are decisions handled when the same topic is discussed across many messages with evolving answers?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to a Telegram group and retrieve all messages posted since the last successful extraction run.
- **FR-002**: System MUST execute extraction runs on a configurable recurring schedule per project (e.g., every 30 minutes, hourly, daily).
- **FR-003**: System MUST analyze message content to identify decision candidates and map them to pre-defined Google Sheet template fields.
- **FR-004**: System MUST present extracted decision candidates to the contractor for review, showing the source message, sender, and timestamp alongside the extracted value.
- **FR-005**: System MUST allow contractors to confirm, edit, or dismiss each decision candidate.
- **FR-006**: System MUST write confirmed decisions to the correct fields in the linked Google Sheet.
- **FR-007**: System MUST maintain a persistent decision log recording every confirmed decision with its source message, sender, timestamp, and confirmation date.
- **FR-008**: System MUST detect which required Google Sheet template fields remain unfilled and present them as a missing-decisions list per project.
- **FR-009**: System MUST support deadline configuration per project phase and alert contractors when required fields for an upcoming deadline remain unfilled within a configurable warning window.
- **FR-010**: System MUST support multiple concurrent projects, each independently configured with its own Telegram group, Google Sheet, and schedule.
- **FR-011**: System MUST allow contractors to configure which template fields correspond to which decision categories.
- **FR-012**: System MUST handle contradictory decisions — when a new message reverses a previously confirmed decision, it MUST surface the conflict for contractor review rather than silently overwriting.
- **FR-013**: System MUST automatically write high-confidence decision extractions to the Google Sheet without requiring manual confirmation, while routing low-confidence or ambiguous extractions to a contractor review queue; contractors MUST be able to correct or revert any auto-confirmed decision at any time.
- **FR-014**: System MUST skip non-text message types (images, voice notes, files) without failing, and log that they were skipped.

### Key Entities

- **Project**: The top-level unit linking a project name, a Telegram group, a Google Sheet, a template configuration, a polling schedule, and a set of deadlines.
- **Telegram Group**: A source channel for messages, identified by group ID or invite link, associated with exactly one project.
- **Message**: An individual text message extracted from a Telegram group, carrying sender identity, timestamp, and raw content.
- **Decision Candidate**: An unconfirmed extraction — a potential decision identified from one or more messages, with a mapped template field and a confidence indicator.
- **Confirmed Decision**: A decision candidate that a contractor has reviewed and approved, optionally with an edited value; the authoritative value for a template field.
- **Template Field**: A named slot in the Google Sheet template belonging to a category (e.g., "Interior Paint Color" in category "Finishes"), which may be required or optional and may be tied to a deadline phase.
- **Decision Log Entry**: An immutable record of a confirmed decision, linking the confirmed value, source messages, sender, original timestamp, confirmation date, and any correction history.
- **Project Phase / Deadline**: A named milestone with a due date, associated with a set of required template fields that must be filled before that date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Contractors spend fewer than 10 minutes per project per day reviewing and confirming extracted decisions.
- **SC-002**: At least 85% of actionable decisions made in Telegram conversations are surfaced as decision candidates within one polling cycle of when they were posted.
- **SC-003**: Zero confirmed decisions are written to the Google Sheet without explicit contractor action.
- **SC-004**: Contractors can identify all missing required decisions for a project in under 30 seconds from the project dashboard.
- **SC-005**: Every Google Sheet entry is fully traceable — each filled field links back to a decision log entry with a source message.
- **SC-006**: Contractors receive deadline alerts at least 48 hours before a phase deadline when required fields remain unfilled.
- **SC-007**: Decision log retrieval for any project returns complete history in under 3 seconds regardless of project age.

## Assumptions

- Each project has exactly one connected Telegram group and one connected Google Sheet in v1; many-to-one and one-to-many mappings are out of scope.
- Google Sheet templates are defined and finalized before a project starts; mid-project template structure changes are out of scope for v1.
- Homeowners are not direct users of this application in v1 — they participate only through the Telegram group, and contractors use the app to manage outputs.
- The application has permission to read all messages in the connected Telegram group (not limited to messages directed at a bot).
- Projects are renovation or construction projects where decisions are categorical and concrete (materials, colors, dimensions, dates, quantities) rather than open-ended.
- Contractors have authority to confirm, edit, or override extracted decisions; homeowner approval workflows are out of scope for v1.
- The polling schedule is set per project at setup time; dynamic schedule changes after setup are out of scope for v1.
- Non-text message content (images, voice notes) may contain decisions but extraction from non-text formats is out of scope for v1.
