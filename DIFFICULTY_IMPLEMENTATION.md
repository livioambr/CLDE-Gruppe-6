# Difficulty Levels Implementation Summary

## What Was Implemented

The Hangman game now supports three difficulty levels that the lobby host can select before starting the game:

- **Leicht (Easy)**: 12 attempts
- **Mittel (Medium)**: 8 attempts (default)
- **Schwer (Hard)**: 4 attempts

## Changes Made

### Frontend Changes

1. **game.html**
   - Added difficulty selector UI with radio buttons
   - Selector only visible to the host before game starts

2. **game.css**
   - Added styles for the difficulty selector
   - Responsive design with hover effects

3. **mobile.css**
   - Added mobile-responsive styles for difficulty selector
   - Stacks options vertically on small screens

4. **game.js**
   - Shows/hides difficulty selector based on host status
   - Reads selected difficulty when starting game
   - Updated hangman drawing logic to scale with difficulty
   - Drawing parts are distributed proportionally across max attempts

5. **socket-client.js**
   - Updated `startGameSocket()` to accept `maxAttempts` parameter

### Backend Changes

1. **socket-handler.js**
   - Updated game start handler to accept `maxAttempts` parameter
   - Passes difficulty to lobby service

2. **lobby-service.js**
   - Updated `startGame()` to accept and store `maxAttempts`
   - Sets both `attempts_left` and `max_attempts` in database

3. **game-service.js**
   - Updated `getGameState()` to return `maxAttempts`
   - Updated `resetGame()` to preserve `max_attempts` value
   - Game resets maintain the selected difficulty

### Database Changes

A new column `max_attempts` needs to be added to the `lobbies` table. See `MIGRATION_DIFFICULTY.md` for instructions.

## How It Works

1. **Host selects difficulty**: Before starting the game, the host sees three difficulty options
2. **Game starts with selected difficulty**: The selected max attempts value is sent to the server
3. **Hangman drawing scales**: The drawing parts are distributed evenly across the available attempts
   - For 12 attempts (Easy): Each part appears every 2 wrong guesses
   - For 8 attempts (Medium): Each part appears every ~1.3 wrong guesses
   - For 4 attempts (Hard): Each part appears every ~0.67 wrong guesses
4. **Difficulty persists**: When the host resets the game, the same difficulty is maintained

## Testing

To test the feature:

1. Run the database migration (see MIGRATION_DIFFICULTY.md)
2. Restart the server
3. Create a new lobby as host
4. You should see the difficulty selector above the "Spiel starten" button
5. Select a difficulty and start the game
6. Make wrong guesses to see the hangman drawing scale appropriately

## Notes

- The difficulty selector is only visible to the host
- The difficulty selector disappears once the game starts
- The selected difficulty is maintained when resetting the game
- Existing lobbies will default to Medium (8 attempts) if the migration is run
