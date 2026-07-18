## MODIFIED Requirements

### Requirement: Scene runs at interactive frame rate

The render loop SHALL target 60fps on the reference desktop, SHALL remain responsive under the mobile quality budget, and SHALL perform no per-frame image detection or unbounded geometry creation. Face preparation SHALL occur once per upload; transient render objects SHALL be pooled or bounded.

#### Scenario: Continuous play

- **WHEN** the scene is active and attacks are being thrown
- **THEN** rendering, physics, contact, and input stay responsive with the cached face texture and bounded transient work

#### Scenario: Expensive quality tier

- **WHEN** measured frame time exceeds the active quality budget
- **THEN** optional render quality reduces before contact, head motion, or input feedback is dropped

### Requirement: Head renders as a 3D face mesh when landmarks are available

When face landmarks are found, the head SHALL render as a normalized, lit front-face mesh integrated with a complete proxy shell, simple ears, hair cap, and edge transition so it reads as a stable head volume rather than an open sheet. Landmark depth SHALL be centered, bounded, and scaled relative to facial anchors. Punch impacts SHALL rotate the head in depth and SHALL deform the contact region with anatomically weighted falloff. When landmarks are not found or the mesh fails validity checks, the system SHALL not enter gameplay.

#### Scenario: Stable 3D head on landmark success

- **WHEN** the game starts with a valid landmark set
- **THEN** the head has a coherent silhouette, readable facial depth, a visually continuous edge/neck relationship, and no paper-thin side view during ordinary recoil

#### Scenario: Bounded depth

- **WHEN** raw landmarks contain noisy or extreme depth values
- **THEN** robust centering, smoothing, and clamps prevent an exploded nose, inverted surface, or extreme head thickness

#### Scenario: Invalid landmarks

- **WHEN** landmarks are absent or fail mesh validity checks
- **THEN** the player returns to upload with a clear error and no partial renderer remains active

### Requirement: Scene renders as a lit 3D room

The scene SHALL render a coherent authored dummy in a grounded room using physically based materials, a key/fill/rim lighting hierarchy, and budgeted contact/dynamic shadows. The torso, shoulder line, adaptive neck, head, weapons, and floor SHALL share a consistent scale and visual language. Screen shake SHALL be applied through the camera rig. This Three.js scene is the only gameplay renderer.

#### Scenario: Grounded room and dummy

- **WHEN** the game starts in 3D mode
- **THEN** the dummy reads as a single character standing in a room, with visible contact grounding and no disconnected floating head or torso

#### Scenario: Neck follows recoil

- **WHEN** the head recoils and rotates
- **THEN** the neck remains connected at plausible chin and shoulder anchors without appearing as a rigid rectangular block or intersecting the face

#### Scenario: Weapon enters the scene

- **WHEN** an authored weapon approaches the head
- **THEN** its scale, shading, shadow, and occlusion remain consistent with the head and room

## ADDED Requirements

### Requirement: Camera composition protects gameplay and HUD

The scene SHALL use a responsive camera rig that frames the head, neck, and useful torso context while reserving safe areas for counters, settings, weapon selection, and the action button.

#### Scenario: Aspect-ratio change
- **WHEN** the viewport changes between supported desktop, landscape, and portrait dimensions
- **THEN** camera distance/target and HUD layout update without cropping the head, obscuring the target, or placing the weapon path behind controls

### Requirement: Head and environment expose surface contact data

The 3D head SHALL provide raycastable surface position, normal, UV, and head-local coordinates for direct pointer targeting and attack resolution.

#### Scenario: Direct cheek target
- **WHEN** the user targets a visible cheek point
- **THEN** the scene resolves a contact record whose world position, normal, UV, and local point correspond to that visible surface

#### Scenario: Head moves during approach
- **WHEN** the target head translates or rotates before contact
- **THEN** the stored head-local target follows the head and remains on the intended region
