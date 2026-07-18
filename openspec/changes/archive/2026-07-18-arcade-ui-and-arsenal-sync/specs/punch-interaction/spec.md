# punch-interaction

## MODIFIED Requirements

### Requirement: Selectable attack arsenal

The system SHALL offer five slapstick attack types — punch, slap, mallet, tomato throw, egg throw — selectable from a weapon dock in the scene UI, each rendered from authored 3D models with a distinct animation, impact physics, and sound. The selected attack SHALL be used by the HIT button, by direct taps on the head, and by the Space key. Attacks SHALL remain impact/food-splat slapstick only — no cutting, burning, stabbing, blood, or gore.

#### Scenario: Slap spins the head

- **WHEN** the user selects slap and hits the head
- **THEN** an open hand sweeps in horizontally and the head reacts with a strong sideways spin

#### Scenario: Thrown food splats

- **WHEN** the user selects tomato or egg and targets a point on the head
- **THEN** the projectile arcs in, splats at that point, and applies a soft knock

#### Scenario: Mallet bonk

- **WHEN** the user lands a mallet attack
- **THEN** the mallet drops from above, the head squashes hard, and a deep bonk plays

## ADDED Requirements

### Requirement: Keyboard controls

The system SHALL support keyboard play: number keys 1–5 select the corresponding weapon, Space triggers the selected attack, and Escape closes the settings panel. Shortcuts SHALL be ignored while typing in form controls.

#### Scenario: Number key selects weapon

- **WHEN** the user presses 3 during play
- **THEN** the third weapon in the dock becomes selected

#### Scenario: Space attacks

- **WHEN** the user presses Space during play
- **THEN** the selected attack fires at the head

## REMOVED Requirements

### Requirement: Extended slapstick arsenal

**Reason**: Arsenal curated to five authored-model weapons; fish, pie, and chili retired.
**Migration**: None — the five remaining attacks cover the same slapstick registers.

### Requirement: Noodles attack

**Reason**: Retired in the authored-assets pass along with its mess system.
**Migration**: None.

### Requirement: Cursor shows the selected weapon

**Reason**: Replaced by the weapon dock with hotkey badges and the selected-weapon readout; a custom cursor fought the tap-anywhere input model.
**Migration**: None.
