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

The system SHALL offer multiple slapstick attack types — punch, slap, tomato throw, egg throw — selectable from a weapon picker in the scene UI. The selected attack SHALL be used by both the action button and direct taps on the head, and each attack SHALL have a distinct animation, impact physics, and sound. Attacks SHALL remain impact/food-splat slapstick only — no cutting, burning, stabbing, blood, or gore.

#### Scenario: Slap spins the head

- **WHEN** the user selects slap and hits the head
- **THEN** an open hand sweeps in horizontally and the head reacts with a strong sideways spin

#### Scenario: Thrown food splats

- **WHEN** the user selects tomato or egg and targets a point on the head
- **THEN** the projectile arcs in, splats at that point, and applies a soft knock

### Requirement: Extended slapstick arsenal

The weapon picker SHALL additionally offer mallet, fish, pie, and chili attacks, each with distinct animation, physics, sound, and impact effect: mallet strikes from above with the strongest knock and an exaggerated squash; fish slaps from the side with a wet thwap; pie splats cream at the impact point; chili paints a red-hot flush at the impact point with fire/steam particles. All attacks SHALL remain slapstick — no blades, fire-on-flesh, impalement, or gore.

#### Scenario: Mallet bonk

- **WHEN** the user lands a mallet attack
- **THEN** the mallet drops from above, the head squashes hard and recoils downward-strongest, and a deep bonk plays

#### Scenario: Chili heat

- **WHEN** the user lands a chili attack at a point on the face
- **THEN** a warm red flush appears at that point with fire/steam particles and a sizzle sound, with no burn or char imagery

