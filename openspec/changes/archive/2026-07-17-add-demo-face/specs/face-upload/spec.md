# face-upload

## ADDED Requirements

### Requirement: Bundled demo face

The system SHALL offer a one-click demo face (a bundled, AI-generated public-domain image) that runs through the standard detection and crop pipeline, and SHALL auto-start the demo when the app is opened with the `demo` query parameter.

#### Scenario: Demo button

- **WHEN** the user activates "try the demo face" on the upload screen
- **THEN** the bundled demo image is loaded and the game starts with its detected face

#### Scenario: Demo deep link

- **WHEN** the app is opened with `?demo=1`
- **THEN** the demo face loads automatically without further interaction
