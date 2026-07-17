# damage-progression Specification

## Purpose
TBD - created by archiving change build-face-punch-mvp. Update Purpose after archive.
## Requirements
### Requirement: Hits are counted and displayed

The system SHALL count landed punches and display the running total in the scene UI.

#### Scenario: Counter increments

- **WHEN** a punch lands
- **THEN** the hit counter increments by one and the display updates

### Requirement: Rapid hits build a combo

The system SHALL track a combo that increments when punches land within a short window (~1s) of the previous punch, resets when the window lapses, and is displayed with escalating flair.

#### Scenario: Combo grows

- **WHEN** a punch lands within the combo window of the previous punch
- **THEN** the combo count increments and is shown (e.g., "12x COMBO!")

#### Scenario: Combo breaks

- **WHEN** no punch lands within the combo window
- **THEN** the combo resets to zero

### Requirement: Cartoon damage accumulates at hit thresholds

The system SHALL add cartoon damage sticker overlays (e.g., black eye, bruise, band-aid, dizzy stars) to the face at predefined hit-count thresholds, anchored to fixed positions relative to the face oval. Damage SHALL be cartoonish only — no blood or realistic injury.

#### Scenario: Threshold reached

- **WHEN** the hit count crosses a damage threshold
- **THEN** the corresponding sticker overlay appears on the face and persists

#### Scenario: Damage caps out

- **WHEN** the hit count passes the final threshold
- **THEN** the maximum cartoon damage state is shown (all stickers + dizzy stars) and no further overlays are added

### Requirement: Damage and counters can be reset

The system SHALL provide a reset control that restores the pristine face, clears all overlays, and zeroes the hit and combo counters without requiring a new upload.

#### Scenario: Reset pressed

- **WHEN** the user presses reset
- **THEN** all damage overlays are removed and hit/combo counters return to zero

