# feedback-juice Specification

## Purpose
TBD - created by archiving change build-face-punch-mvp. Update Purpose after archive.
## Requirements
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

### Requirement: Punch impact deforms the face locally

A landed punch SHALL locally deform the face around the impact point (a dent pushed along the punch direction with distance falloff) that elastically springs back within ~0.5s. Deformation SHALL work for both auto-detected and manually-cropped faces.

#### Scenario: Cheek dent on hit

- **WHEN** a punch lands on a point of the head
- **THEN** the face visibly dents around that point and springs back to rest within ~0.5s

#### Scenario: Rest state is undeformed

- **WHEN** no punch has landed recently
- **THEN** the face renders identically to its undeformed bitmap

### Requirement: Face deformation is anatomically weighted

Face deformation SHALL vary by facial region derived from face landmarks — soft regions (cheeks, jaw) deform visibly more than stiff regions (forehead) — and each dent SHALL displace surrounding flesh outward in a ring. If individual anatomical anchors are unavailable inside an otherwise valid rig, deformation SHALL use conservative bounded weights.

#### Scenario: Cheek hit squishes more than forehead hit

- **WHEN** equal-strength punches land on the cheek and on the forehead
- **THEN** the cheek deformation is visibly larger than the forehead deformation

#### Scenario: Flesh bulges around the dent

- **WHEN** a punch dents the face
- **THEN** the area surrounding the dent bulges outward before springing back

#### Scenario: Landmarks unavailable

- **WHEN** landmark detection fails on the face bitmap (e.g., manual crop of a non-face)
- **THEN** deformation remains bounded using conservative regional weights
