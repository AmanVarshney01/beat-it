## MODIFIED Requirements

### Requirement: Punch impact produces squash-and-stretch

On contact the head rig SHALL compress along the resolved impact direction with magnitude and duration defined by the attack, preserve volume through perpendicular bulge, and recover with bounded overshoot. This render deformation SHALL be synchronized with, but remain numerically separate from, rigid-head physics.

#### Scenario: Squash on hit

- **WHEN** a punch lands
- **THEN** visible compression begins on the contact frame, bulges perpendicular to the impact, and elastically returns without inverting or collapsing the face

#### Scenario: Weapon weight changes compression

- **WHEN** equal-strength food and mallet attacks land
- **THEN** food produces a shallow soft compression while the mallet produces a deeper, slower, bounded compression

### Requirement: Punch impact produces screen shake

Each landed attack SHALL add a directional, damped camera impulse whose translation, rotation, frequency, and decay are defined by the attack. Camera motion SHALL use smooth or band-limited noise rather than independent random offsets per frame and SHALL respect the user's shake setting.

#### Scenario: Shake on hit

- **WHEN** a punch lands with shake enabled
- **THEN** camera motion begins on contact, reflects the impact direction, and decays smoothly to rest

#### Scenario: Shake disabled

- **WHEN** an attack lands with shake disabled
- **THEN** no camera impulse is applied while other contact feedback remains active

### Requirement: Punch impact spawns physical particles

Each landed attack SHALL spawn a weapon-specific, bounded particle burst at the resolved world contact, oriented by the attack direction and visible surface contact. Impact attacks SHALL add a compact cone of gravity-driven blood droplets when blood spatter is enabled. Gameplay effects SHALL use drawn physical sparks, droplets, fragments, or smoke and SHALL NOT use emoji or comic-word overlays.

#### Scenario: Particles on hit

- **WHEN** a punch lands
- **THEN** impact sparks or debris originate at the visible surface contact and move away from the face rather than appearing at a stale screen coordinate

#### Scenario: Food particles

- **WHEN** food contacts the face
- **THEN** its shell, pulp, spark, or smoke palette matches the weapon and does not resemble blood

#### Scenario: Directional blood droplets

- **WHEN** blood spatter is enabled and punch, slap, or mallet contacts the face
- **THEN** a bounded set of small dark-red droplets originates at that exact visible contact, continues in the attack direction, falls under gravity, and is recycled after a short lifetime

### Requirement: Punch impact plays a comic sound

Each attack SHALL schedule its whoosh, anticipation accent, contact transient, body/resonance layer, and optional residue sound from its phase timeline. Contact sound SHALL play on the resolved contact frame with bounded pitch variation; audio SHALL initialize on the first user gesture.

#### Scenario: Sound on hit

- **WHEN** an attack contacts the head and sound is enabled
- **THEN** its contact transient plays on the same frame as visible compression with a material/weight-appropriate body sound

#### Scenario: First interaction unlocks audio

- **WHEN** the user's first attack occurs before any audio has played
- **THEN** the audio context is initialized by that gesture and scheduled timeline sounds still play

### Requirement: Punch impact deforms the face locally

A landed attack SHALL deform the 3D face around the resolved local surface point with anatomical weighting, distance falloff, capped displacement, and elastic recovery.

#### Scenario: Cheek dent on hit

- **WHEN** a punch lands on a visible cheek point
- **THEN** the cheek indents at that point, surrounding flesh bulges, boundary vertices remain stable, and the face returns to rest

#### Scenario: Glancing hit

- **WHEN** a slap contacts with a strong tangential component
- **THEN** the deformation includes a brief lateral drag without sliding residue away from its resolved UV

#### Scenario: Rest state is undeformed

- **WHEN** no attack has landed recently
- **THEN** all transient deformation offsets and velocities settle exactly to the normalized rest mesh

## ADDED Requirements

### Requirement: Contact feedback is atomically synchronized

Head impulse, local deformation, weapon contact pose, camera impulse, particles, sound, and residue SHALL consume the same immutable contact event and begin within one animation frame of its timestamp.

#### Scenario: Contact audit
- **WHEN** deterministic review pauses on an attack contact frame
- **THEN** weapon/head contact, compression, physics impulse, camera impulse start, particle origin, audio schedule, and residue UV all refer to the same surface point and direction

### Requirement: Strong hits include bounded hit-stop

Heavy attacks SHALL support a short presentation-only hit-stop or time-scale dip at contact, with duration capped so rapid input and browser responsiveness are preserved.

#### Scenario: Mallet hit-stop
- **WHEN** the mallet lands at normal strength
- **THEN** weapon/head presentation briefly holds the contact pose before follow-through while input remains queued and the pause stays below the configured maximum

### Requirement: Attacks can trigger selectable spoken reactions

The settings menu SHALL offer Off, Female, and Male reaction-voice modes. When enabled, landed attacks SHALL trigger simple, short reactions such as "Ouch!", "Oh no!", or "Please stop!" using a matching local English speech voice when available, with pitch fallback, repeat avoidance, and a cooldown that prevents overlapping rapid-hit speech. The main sound toggle SHALL mute both effects and spoken reactions.

#### Scenario: Slap uses a short reaction

- **WHEN** a slap lands while Female or Male reaction voice is enabled
- **THEN** the selected voice delivers one short reaction without a setup or long joke

#### Scenario: Mallet uses a short reaction

- **WHEN** a mallet lands while spoken reactions are enabled
- **THEN** the selected voice delivers one short reaction such as "Ouch!" or "Oh no!"

#### Scenario: Reaction voice is disabled

- **WHEN** Reaction voice is Off or the main sound toggle is muted
- **THEN** no spoken utterance is queued while all unrelated enabled feedback continues normally

#### Scenario: Rapid hits do not overlap speech

- **WHEN** multiple attacks land during the spoken-reaction cooldown
- **THEN** at most one reaction plays and queued voices do not accumulate
