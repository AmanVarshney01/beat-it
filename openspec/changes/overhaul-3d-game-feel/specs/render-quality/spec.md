## ADDED Requirements

### Requirement: Scene uses a coherent physically based render pipeline

The 3D game SHALL render color textures in sRGB, use filmic tone mapping, and use physically based materials with intentional roughness, metalness, and normal treatment. Uploaded face pixels SHALL retain recognizable color without appearing self-lit, plastic, or crushed into shadow.

#### Scenario: Resting scene material read
- **WHEN** the demo face scene is shown at rest
- **THEN** skin, cloth, painted metal, wood, ceramic, food, and rubber surfaces are distinguishable through highlight shape and roughness while sharing one lighting environment

#### Scenario: Face remains recognizable
- **WHEN** the uploaded face is rendered under the game lighting
- **THEN** its identity and midtone color remain readable without flat ambient wash or clipped specular glare

### Requirement: Lighting establishes form and contact

The 3D scene SHALL use a key/fill/rim hierarchy, budgeted dynamic shadows, and contact grounding so the head, neck, dummy, weapons, and floor occupy a consistent space.

#### Scenario: Character is grounded
- **WHEN** the scene is viewed before an attack
- **THEN** the dummy and head have readable form, a visible floor relationship, and contact shadows instead of floating against a flat background

#### Scenario: Weapon crosses the head
- **WHEN** a weapon passes in front of or beside the head
- **THEN** occlusion, highlights, and shadows consistently communicate which object is nearer to the camera

### Requirement: Camera preserves composition and depth

The camera rig SHALL frame the head and upper dummy consistently across supported aspect ratios, reserve safe areas for HUD controls, and apply bounded damped impact impulses without losing the target.

#### Scenario: Desktop composition
- **WHEN** the scene renders at 1440×900
- **THEN** the full head, neck connection, useful torso context, weapon path, counters, and controls remain visible without overlap

#### Scenario: Mobile composition
- **WHEN** the scene renders at 390×844
- **THEN** the head remains the focal point while controls and the selected weapon path stay inside safe areas

#### Scenario: Strong impact camera motion
- **WHEN** the strongest mallet hit lands
- **THEN** the camera impulse reinforces direction and weight, decays smoothly, and never clips the head out of frame

### Requirement: Authored stages frame the target without adding runtime load

The game SHALL provide multiple visually distinct environments with stage-specific wall art, floor treatment, and lighting. Each environment SHALL preserve a quiet central target area and SHALL be uploaded as one reusable backdrop texture rather than recurring decorative geometry.

#### Scenario: Stage is changed
- **WHEN** the player selects a different stage in settings
- **THEN** the wall, floor, and light palette change immediately while the head, exact contact targeting, damage marks, and active interaction remain unchanged

#### Scenario: Stage runs during rapid input
- **WHEN** the player performs ten rapid attacks in any stage
- **THEN** the stage adds no per-hit geometry, material, or texture allocation and does not introduce progressive slowdown

### Requirement: Render quality adapts within explicit budgets

The renderer SHALL cap device pixel ratio, pool transient objects, monitor moving frame time, and reduce shadow and particle budgets through deterministic quality tiers before disabling core interaction feedback.

#### Scenario: Desktop budget
- **WHEN** the deterministic ten-hit review sequence runs at 1440×900 on the reference desktop
- **THEN** median frame time is at or below 16.7 ms with no progressive slowdown

#### Scenario: Mobile-equivalent budget
- **WHEN** the same sequence runs at 390×844 with DPR capped at 1.25
- **THEN** median frame time is at or below 25 ms and no frame-time spike remains above 50 ms for more than two consecutive frames

#### Scenario: Quality reduction
- **WHEN** moving frame time exceeds the active tier budget
- **THEN** optional shadow resolution and particle density reduce in a stable order while input, contact, head motion, and residue remain active

### Requirement: Visual states are deterministically reviewable

Development builds SHALL provide a deterministic review mode that can select the demo face, seed, viewport, quality tier, attack, target, and attack phase or frame.

#### Scenario: Contact frame replay
- **WHEN** review mode is opened twice with the same seed, attack, target, viewport, and contact frame
- **THEN** both renders produce the same weapon pose, head pose, contact point, particles, and residue state within screenshot tolerance

#### Scenario: Arsenal review
- **WHEN** the arsenal review sequence runs
- **THEN** it captures rest, anticipation, contact, follow-through, residue, and reset states for every weapon

### Requirement: Three.js resources have bounded lifetimes

The scene SHALL reuse shared GLB geometry and materials, pool transient instances, and release scene-owned render resources when changing faces or destroying the game.

#### Scenario: Repeated attacks and resets
- **WHEN** every weapon is used repeatedly across ten reset cycles
- **THEN** scene-node, geometry, material, texture, projectile, and particle counts return to their bounded idle levels after each reset

#### Scenario: New face
- **WHEN** the user leaves the game and starts with another face
- **THEN** the previous face texture, head geometry, transient instances, observers, animation frame, and scene-owned GPU resources are released
