## ADDED Requirements

### Requirement: Background stage selection

The system SHALL provide a persisted stage selector with Studio, Boxing Gym, Midway, and Rooftop options. The selected stage SHALL apply immediately to the Three.js renderer.

#### Scenario: Stage applies immediately
- **WHEN** the player chooses a different stage
- **THEN** the environment changes without restarting the game or clearing hits, combo, damage, or the selected weapon

#### Scenario: Stage selection persists
- **WHEN** the player chooses a stage and reloads the app
- **THEN** the same stage is restored from local settings
