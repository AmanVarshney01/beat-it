# game-settings Specification

## Purpose
TBD - created by archiving change add-attack-arsenal-and-settings. Update Purpose after archive.
## Requirements
### Requirement: Effect toggles

The system SHALL provide a settings menu with independent toggles for sound, screen shake, impact particles, damage marks, blood spatter, dizzy stars, and idle sway. Toggles SHALL take effect immediately and persist across sessions (localStorage).

#### Scenario: Toggle takes effect immediately

- **WHEN** the user disables screen shake and lands an attack
- **THEN** no screen shake occurs while all other feedback still plays

#### Scenario: Settings persist

- **WHEN** the user changes a toggle and reloads the app
- **THEN** the changed setting is still applied

#### Scenario: Blood effects are disabled independently

- **WHEN** the player disables blood spatter
- **THEN** later impact attacks produce no blood stains or droplets while bruises and other enabled feedback continue

### Requirement: Player cap customization

The system SHALL let the player enable an authored 3D cap, choose any six-digit color, and enter an optional centered front label of up to 12 characters. Visibility, color, and text SHALL apply immediately and persist across sessions.

#### Scenario: Cap customization applies

- **WHEN** the player enables the cap, selects a color, and enters a name
- **THEN** a matching 3D cap with centered readable text appears on the moving head

#### Scenario: Plain cap

- **WHEN** the player leaves the front text empty
- **THEN** the selected cap renders without a label

#### Scenario: Cap customization persists

- **WHEN** the player reloads after customizing the cap
- **THEN** the same visibility, color, and text are restored
