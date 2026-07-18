# punch-interaction Specification

## Purpose
TBD - created by archiving change build-face-punch-mvp. Update Purpose after archive.
## Requirements
### Requirement: Punch can be triggered by button or by hitting the head

The system SHALL trigger a punch when the user presses the punch button, and SHALL also trigger a punch when the user clicks/taps directly on the head.

#### Scenario: Button punch

- **WHEN** the user presses the punch button
- **THEN** a punch is thrown at the head

#### Scenario: Direct hit

- **WHEN** the user clicks or taps on the head in the scene
- **THEN** a punch is thrown at the clicked point on the head

### Requirement: Punch shows a fist strike animation

Each punch SHALL animate a cartoon fist entering the scene, striking the head at the impact point, and retracting.

#### Scenario: Fist animation plays

- **WHEN** a punch is triggered
- **THEN** the fist sprite animates in, contacts the head at the impact point, and retracts within a short duration (≤300ms total)

### Requirement: Punch impact drives head physics

On fist contact, the system SHALL apply an impulse to the head body scaled by punch strength and directed from the impact point.

#### Scenario: Impact impulse

- **WHEN** the fist contacts the head
- **THEN** an impulse is applied at the impact point and the head recoils accordingly

### Requirement: Rapid punching is supported

The system SHALL allow punches in quick succession without input drops; a new punch MAY interrupt the previous fist animation.

#### Scenario: Button mashing

- **WHEN** the user triggers punches faster than the fist animation duration
- **THEN** every input registers a hit and feedback plays for each, with the fist animation restarting as needed

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

### Requirement: Weapons render as 3D models with depth

Every weapon SHALL render as an authored 3D model (no emoji): thrown food SHALL fly from the viewer's position into the scene with visible depth and tumble before breaking at contact; melee weapons SHALL swing in as 3D models with readable contact and follow-through.

#### Scenario: Tomato flies in depth

- **WHEN** the user throws a tomato at the face
- **THEN** a 3D tomato approaches from the viewer, shrinking toward the scene, and splats at the aimed point

### Requirement: Keyboard controls

The system SHALL support keyboard play: number keys 1–5 select the corresponding weapon, Space triggers the selected attack, and Escape closes the settings panel. Shortcuts SHALL be ignored while typing in form controls.

#### Scenario: Number key selects weapon

- **WHEN** the user presses 3 during play
- **THEN** the third weapon in the dock becomes selected

#### Scenario: Space attacks

- **WHEN** the user presses Space during play
- **THEN** the selected attack fires at the head
