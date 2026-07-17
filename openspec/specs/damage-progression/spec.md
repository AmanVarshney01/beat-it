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

The system SHALL paint progressively worsening bruise damage into the face texture at predefined hit-count thresholds, anchored to facial landmarks (eye socket, cheekbone, brow, jaw) when available and to fixed positions relative to the face oval otherwise. Bruising SHALL look realistic (layered discoloration and mottling on the skin) but SHALL remain blood-free — no cuts, blood, or gore. In 3D mode the painted damage SHALL wrap and light with the face mesh.

#### Scenario: Threshold reached

- **WHEN** the hit count crosses a damage threshold
- **THEN** the corresponding bruise is painted into the face texture and persists

#### Scenario: Damage caps out

- **WHEN** the hit count passes the final threshold
- **THEN** all bruises deepen to their maximum intensity and dizzy stars orbit the head, with no further damage added

#### Scenario: Damage stays blood-free

- **WHEN** any damage stage renders
- **THEN** the face shows bruising and swelling only — no blood, cuts, or gore

### Requirement: Damage and counters can be reset

The system SHALL provide a reset control that restores the pristine face, clears all overlays, and zeroes the hit and combo counters without requiring a new upload.

#### Scenario: Reset pressed

- **WHEN** the user presses reset
- **THEN** all damage overlays are removed and hit/combo counters return to zero

