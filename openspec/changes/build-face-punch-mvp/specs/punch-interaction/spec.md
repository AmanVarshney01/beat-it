# punch-interaction

## ADDED Requirements

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
