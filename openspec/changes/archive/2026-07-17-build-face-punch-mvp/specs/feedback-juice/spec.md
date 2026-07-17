# feedback-juice

## ADDED Requirements

### Requirement: Punch impact produces squash-and-stretch

On impact the head sprite SHALL squash along the impact axis and spring back with overshoot, as a render-only effect independent of the physics simulation.

#### Scenario: Squash on hit

- **WHEN** a punch lands
- **THEN** the head visibly squashes toward the impact direction and elastically returns within ~250ms

### Requirement: Punch impact produces screen shake

Each landed punch SHALL trigger a brief screen shake whose magnitude scales with punch strength and decays quickly.

#### Scenario: Shake on hit

- **WHEN** a punch lands
- **THEN** the scene offset shakes and decays to zero within ~300ms

### Requirement: Punch impact spawns comic particles

Each landed punch SHALL spawn short-lived cartoon particles at the impact point, including stars and comic onomatopoeia (e.g., "POW!", "BAM!").

#### Scenario: Particles on hit

- **WHEN** a punch lands
- **THEN** star particles and a random onomatopoeia burst from the impact point and fade out

### Requirement: Punch impact plays a comic sound

Each landed punch SHALL play a cartoon hit sound, randomly chosen from a small pool with slight pitch variation; audio SHALL initialize on first user gesture to satisfy autoplay policies.

#### Scenario: Sound on hit

- **WHEN** a punch lands and sound is enabled
- **THEN** a comic hit sound plays with randomized pitch

#### Scenario: First interaction unlocks audio

- **WHEN** the user's first punch occurs before any audio has played
- **THEN** the audio context is initialized by that gesture and the hit sound still plays

### Requirement: Sound can be muted

The system SHALL provide a mute toggle that silences all sounds and persists for the session.

#### Scenario: Mute toggled

- **WHEN** the user enables mute
- **THEN** subsequent punches produce no sound until mute is disabled
