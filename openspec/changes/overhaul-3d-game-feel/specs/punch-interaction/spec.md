## MODIFIED Requirements

### Requirement: Punch shows a fist strike animation

Each punch SHALL use an authored phase timeline with anticipation, approach, contact, follow-through, and recovery. The glove SHALL be correctly oriented around a stable grip/pivot, visibly compress or dwell at contact, and then recover without teleporting.

#### Scenario: Fist animation plays

- **WHEN** a punch is triggered
- **THEN** the glove winds up, accelerates toward the moving target, contacts with a short compression/dwell, follows through, and retracts with no discontinuous transform

#### Scenario: Contact frame

- **WHEN** the punch timeline enters contact
- **THEN** the glove surface and head surface meet at the resolved target without a visible gap or deep interpenetration

#### Scenario: Contact-facing melee silhouette

- **WHEN** a punch or slap approaches from either side of the face
- **THEN** the glove presents its knuckles and the open hand presents its palm without turning edge-on or flipping upside down

#### Scenario: Direct hits enter from the selected side

- **WHEN** the player directly targets the left or right half of the face with punch, slap, or mallet
- **THEN** the attack originates from that same side, travels toward the selected surface point, and follows through in the incoming direction

### Requirement: Punch impact drives head physics

On contact the system SHALL create one resolved contact event and SHALL derive the Matter.js impulse direction, angular response, head deformation, and render feedback from that event and the selected attack definition.

#### Scenario: Impact impulse

- **WHEN** a weapon contacts the head
- **THEN** the head recoils and rotates away from the resolved surface contact with magnitude appropriate to weapon weight and speed

#### Scenario: Moving target

- **WHEN** the head has moved since the attack was launched
- **THEN** the impact uses the target's current world position rather than the stale launch-screen coordinate

### Requirement: Weapons render as 3D models with depth

In 3D mode every weapon SHALL use an authored Blender/glTF model with a documented canonical scale, pivot, forward axis, material assignment, and collision/contact region. Thrown food SHALL travel through camera depth with readable perspective and tumble; melee weapons SHALL follow weapon-specific arcs. In 2D fallback mode, weapons SHALL use thumbnails or staged sprites rendered from the same authored assets.

#### Scenario: Authored model loads

- **WHEN** the arsenal GLB is available
- **THEN** each picker choice spawns the matching named asset with correct scale, orientation, PBR material, and shadow behavior

#### Scenario: Asset load fails

- **WHEN** the arsenal GLB cannot be loaded
- **THEN** a bounded procedural fallback preserves playability and reports one non-fatal diagnostic

#### Scenario: Tomato flies in depth

- **WHEN** the user throws a tomato at the face
- **THEN** the authored tomato approaches from the viewer, follows an arc, tumbles around its center of mass, contacts the moving target, and breaks into residue rather than disappearing early

## ADDED Requirements

### Requirement: Every attack has weapon-specific choreography

Each attack definition SHALL specify phase durations, transform curves, contact dwell, impulse, deformation, camera response, particles, audio, and residue rather than relying on one shared impact fraction.

#### Scenario: Compare mallet and slap
- **WHEN** the deterministic review mode plays mallet and slap at equal strength
- **THEN** the mallet shows side-aware diagonal weight and compression while the slap shows a fast palm-led lateral arc and stronger spin

#### Scenario: Compare food and melee
- **WHEN** thrown food and a melee weapon complete contact
- **THEN** food breaks/splats and exits through residue while melee preserves a readable follow-through and recovery

### Requirement: Active attacks are pooled, bounded, and resettable

The system SHALL support rapid input through bounded pooling and SHALL completely release or recycle active weapon, fragment, trail, and timeline instances on completion, reset, scene destruction, or overflow.

#### Scenario: Button mashing
- **WHEN** attacks are triggered faster than their recovery phases
- **THEN** accepted inputs create distinct bounded attack instances without teleporting an existing weapon or dropping contact feedback

#### Scenario: Reset during attack
- **WHEN** reset is activated during any attack phase
- **THEN** every active weapon and associated transient effect is removed or returned to its pool in the same reset operation
