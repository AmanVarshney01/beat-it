## ADDED Requirements

### Requirement: Background stage selection

The system SHALL provide a persisted stage selector with Studio, Boxing Gym, Midway, and Rooftop options. The selected stage SHALL apply immediately to the Three.js renderer.

#### Scenario: Stage applies immediately
- **WHEN** the player chooses a different stage
- **THEN** the environment changes without restarting the game or clearing hits, combo, damage, or the selected weapon

#### Scenario: Stage selection persists
- **WHEN** the player chooses a stage and reloads the app
- **THEN** the same stage is restored from local settings

### Requirement: Custom player cap

The system SHALL provide a persisted player-cap option with an on/off control, unrestricted six-digit color selection, and an optional front label of up to 12 characters. The cap SHALL render as an authored 3D accessory attached to the head rig, and the front label SHALL remain readable against the selected cap color.

#### Scenario: Cap is enabled
- **WHEN** the player enables the cap
- **THEN** the authored cap appears on the head immediately and follows idle sway, recoil, rotation, squash, and recovery

#### Scenario: Cap color changes
- **WHEN** the player selects a different color
- **THEN** the crown, brim, and top button update immediately without rebuilding cap geometry

#### Scenario: Player enters cap text
- **WHEN** the player enters a name or label up to 12 characters
- **THEN** that text is centered on the front of the cap in a high-contrast treatment

#### Scenario: Cap text is empty
- **WHEN** the player clears the cap text
- **THEN** the cap remains wearable with a clean unlabelled front

#### Scenario: Cap settings persist
- **WHEN** the player reloads after changing cap visibility, color, or text
- **THEN** the same cap customization is restored from local settings
