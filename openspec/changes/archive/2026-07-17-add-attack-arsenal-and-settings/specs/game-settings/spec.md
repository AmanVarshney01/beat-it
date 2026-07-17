# game-settings

## ADDED Requirements

### Requirement: Effect toggles

The system SHALL provide a settings menu with independent toggles for sound, screen shake, particles and comic words, damage marks, dizzy stars, and idle sway. Toggles SHALL take effect immediately and persist across sessions (localStorage).

#### Scenario: Toggle takes effect immediately

- **WHEN** the user disables screen shake and lands an attack
- **THEN** no screen shake occurs while all other feedback still plays

#### Scenario: Settings persist

- **WHEN** the user changes a toggle and reloads the app
- **THEN** the changed setting is still applied
