# Tournament System for Firebot

A comprehensive and feature-rich tournament management system for Firebot, designed to create and manage advanced tournament brackets with extensive customization options.

## Features

### Core Functionality

### Tournament Formats
- **Single Elimination**: Traditional knockout format where one loss eliminates a player
- **Double Elimination**: Players get a second chance through a losers bracket
- **Round-Robin**: All players compete against each other, with points-based rankings

## Tournament Format Details

### Single Elimination
- Players face off in brackets
- One loss = elimination
- Winner advances through bracket
- Final match determines champion
- Best for: Quick tournaments, limited time

### Double Elimination
- Two bracket system: Winners and Losers
- Lose in Winners = drop to Losers bracket
- Lose in Losers = elimination
- Grand Finals: Winners champion vs Losers champion
- True Final: If Losers champion wins first Grand Final
- Best for: Competitive fairness, longer events

### Round-Robin
- Every player faces every other player
- Points awarded for wins/draws/losses
- Final standings based on total points
- Tiebreakers supported
- Best for: League play, skill assessment, small player counts

### Tournament Creation & Management
- Create tournaments with multiple players
- Two input modes:
  - Manual player entry
  - Text area/variable input for bulk player entry
- Automatic seeding system
- Match winner selection
- Tournament progression tracking
- Reset tournament with 30-second undo window
- Manual tournament start/stop
- Tournament backup system with 7-day retention
- Automatic cleanup of ended tournaments after 7 days

### Match Management
- Set match winners by player number
- Track current and completed matches
- Round-Robin specific features:
  - Allow/disallow draws
  - Draw handling (replay match or random winner)
  - Customizable point system (win/draw/loss)
- Match history tracking
- Automatic bracket progression
- Finals and Grand Finals support (Double Elimination)

### Player Tracking
- Seed numbers for each player
- Win/loss record tracking
- Elimination status
- Bracket position (winners/losers/eliminated)
- Round-Robin standings and points

## Display Features

### Visual Customization
- **Colors**:
  - Custom background color
  - Custom accent color
  - Custom text color
  - Custom title color
  - Winner color and text color
  - Loser color
  - Border and shadow colors
  - Player card and stats card colors
  - Badge colors (seed, wins, losses, percentage)
  - Badge text colors

- **Round-Robin Standings Colors**:
  - Standings background colors
  - Player/stats card colors
  - Title, points, and record colors
  - Individual rank colors (1st-5th place and others)
  - Rank-specific text colors

- **Layout**:
  - Adjustable tournament scale
  - Custom font size
  - Two-line layout option
  - Colored stat badges option

### Display Options
- Toggle seed number visibility
- Toggle bracket name display
- Toggle match animations
- Toggle winner display graphic
- Winner graphic options:
  - SVG Trophy icon (default included)
  - Custom image (URL or local file)
- Toggle wins/losses/record display
- Toggle Round-Robin standings
- Max visible matches (1-5)
- Max visible standings (1-10)
- Custom bracket names:
  - Winners Bracket title
  - Losers Bracket title
  - Single Elimination title
  - Finals title
  - Optional short names for compact display

### Round-Robin Standings
- Real-time point calculations
- Standings display options:
  - Split view (separate from main bracket)
  - Integrated view
- Two-line layout for standings
- Customizable standings position
- Show current match status
- Rank-based color coding (top 5 + others)

### Positioning
- 9 preset positions:
  - Top Left/Middle/Right
  - Middle Left/Center/Right
  - Bottom Left/Middle/Right
- Random position option
- Custom coordinate positioning
- Separate positioning for standings
- Multiple overlay instance support

### Animations
- Match transition animations
- Winner highlighting effects
- Bracket progression animations
- Standings updates

## Backup System

### Backup Features
- Automatic backup on tournament removal
- 7-day backup retention
- Backup restoration options:
  - Restore to new tournament
  - Overwrite existing tournament
- Backup browsing interface
- Manual backup deletion
- Backup search by tournament name

### How Backups Work
1. When you remove a tournament, it's automatically backed up
2. Backups are stored for 7 days
3. After 7 days, old backups are automatically cleaned up
4. You can restore a backup at any time within 7 days
5. If restoring would overwrite an existing tournament, you'll be prompted to confirm

## UI Elements

### Real-time UI Features
- Live match updates
- Animated bracket progression
- Winner highlighting
- Player elimination indicators
- Round-Robin standings updates
- Current match highlighting

## Technical Features

### Data Management
- SQLite database storage
- Automatic data cleanup
- Match history tracking
- Player statistics tracking
- Tournament state persistence
- Multiple overlay instance support
- Unicode characters and player names support

### Match Resolution
- Automatic bracket generation
- Smart seeding system
- Double elimination bracket logic:
  - Winners bracket progression
  - Losers bracket advancement
  - Grand Finals with true final support
- Round-Robin logic:
  - All vs all match generation
  - Point calculation
  - Tiebreaker support

## Events System

### Tournament Events
The system triggers three events that can be used to create custom responses:

1. **Tournament Started**
   - Triggered when a new tournament begins
   - Metadata includes:
     - `tournamentId` - Unique tournament identifier
     - `tournamentTitle` - Tournament display name
     - `players` - Array of player names

2. **Tournament Match Updated**
   - Triggered when a match is completed
   - Metadata includes:
     - `tournamentId` - Tournament identifier
     - `tournamentTitle` - Tournament name
     - `matchNumber` - Match number in sequence
     - `player1` - First player name
     - `player2` - Second player name
     - `winner` - Winning player name
     - `bracketStage` - Current bracket (winners/losers/final)
     - `round` - Current round number
     - `isDraw` - Whether match was a draw (Round-Robin only)
     - `drawHandling` - How draw was handled (replay/random)

3. **Tournament Ended**
   - Triggered when a tournament is completed
   - Metadata includes:
     - `tournamentId` - Tournament identifier
     - `tournamentTitle` - Tournament name
     - `winner` - Tournament winner name
     - `matchesPlayed` - Total number of matches
     - `duration` - Tournament duration in seconds

## Variables System

### Tournament Information Variables

#### `$tournamentWinner`
Gets the winner of a completed tournament.
```
$tournamentWinner[tournamentId]
```
**Examples:**
- `$tournamentWinner[tournament_example]` - Returns the name of the tournament winner

#### `$tournamentStatus`
Gets the current status of a tournament.
```
$tournamentStatus[tournamentId, mode?]
```
**Possible Returns:**
- `active` - Tournament is currently running
- `paused` - Tournament is paused
- `ended` - Tournament has ended
- `manually_stopped` - Tournament was manually stopped
- `completed_with_winner` - Tournament completed with a winner
- `backed_up` - Tournament is in backups (when using `backups` mode)
- `not_found` - Tournament doesn't exist

**Examples:**
- `$tournamentStatus[example]` - Gets status of active tournament
- `$tournamentStatus[example, backups]` - Checks backup tournaments

#### `$tournamentStage`
Gets the current stage and round information.
```
$tournamentStage[tournamentId]
```
**Examples:**
- `$tournamentStage[tournament_example]` - Returns "Winners Bracket - Quarterfinals"

#### `$tournamentCurrentMatch`
Gets information about the current match.
```
$tournamentCurrentMatch[tournamentId, property?]
```
**Properties:**
- `matchNumber` - Current match number
- `player1` - First player name
- `player2` - Second player name
- `bracket` - Current bracket (winners/losers/final/round-robin)
- `round` - Current round number

**Examples:**
- `$tournamentCurrentMatch[tournament_example]` - Full match info
- `$tournamentCurrentMatch[tournament_example, player1]` - Just player 1's name
- `$tournamentCurrentMatch[tournament_example, matchNumber]` - Just match number

#### `$tournamentPlayerStatus`
Gets the status of a specific player.
```
$tournamentPlayerStatus[tournamentId, playerName]
```
**Possible Returns:**
- "In winners bracket, waiting for next match"
- "In losers bracket, waiting for next match"
- "In current match (#X, Y bracket)"
- "Eliminated"
- "Tournament winner"
- "Tournament not found"
- "Player not found"

**Examples:**
- `$tournamentPlayerStatus[tournament_example, Player1]`

#### `$tournamentStandings`
Gets Round-Robin tournament standings.
```
$tournamentStandings[tournamentId, format?, limit?]
```
**Formats:**
- `full` (default) - Complete standings with all stats
- `compact` - Condensed version
- `raw` - Raw data

**Examples:**
- `$tournamentStandings[tournament_example]` - Full standings
- `$tournamentStandings[tournament_example, compact, 3]` - Top 3 players only

#### `$tournamentMatches`
Gets information about matches.
```
$tournamentMatches[tournamentId, filter?]
```
**Filters:**
- `current` - Only current matches
- `completed` - Only completed matches
- `count` - Total match count
- (no filter) - All matches

**Examples:**
- `$tournamentMatches[tournament_example, current]` - Current matches
- `$tournamentMatches[tournament_example, count]` - Number of matches

#### `$findTournamentId`
Search for a tournament by keyword.
```
$findTournamentId[searchTerm, mode?]
```
**Modes:**
- `all` (default) - Search everywhere
- `active` - Active tournaments only
- `ended` - Ended tournaments only
- `backups` - Backup tournaments only

**Examples:**
- `$findTournamentId[summer]` - Finds tournament with "summer" in name
- `$findTournamentId[summer, active]` - Search only active tournaments

### Accessibility
- ARIA labels throughout UI

## Usage

### Creating a Tournament

1. **Add the "Tournament System" effect** to any effect list
2. **Configure basic settings:**
   - Set the tournament title
   - Choose tournament format (Single/Double Elimination or Round-Robin)
   - Add players (manual or text/variables)
   - Configure visual settings
   - Set positioning

3. **Format-Specific Settings:**

   **Single/Double Elimination:**
   - Choose max visible matches
   - Toggle seed display
   - Toggle bracket names
   - Configure winner display

   **Round-Robin:**
   - Set points per win (default: 3)
   - Set points per draw (default: 1)
   - Set points per loss (default: 0)
   - Allow/disallow draws
   - Configure standings display
   - Set max visible standings

### Managing a Tournament

Use the **"Tournament System Updater"** effect for:

1. **Set Match Winner:**
   - Select tournament
   - Choose match number
   - Select winning player (1 or 2)
   - For Round-Robin draws: choose handling method

2. **Update Visual Settings:**
   - Change any color or style setting
   - Adjust display options
   - Update bracket names

3. **Tournament Controls:**
   - Show/hide tournament
   - Reset tournament (with 30s undo)
   - Stop tournament
   - Remove tournament

### Managing Backups

Use the **"Advanced Tournament Backup Manager"** effect to:
- View all backed up tournaments
- Restore tournaments from backups
- Delete old backups
- Check backup dates

### Tips and Best Practices

1. **Tournament Planning:**
   - Use descriptive tournament titles for easier management
   - Plan your player count (powers of 2 work best for elimination formats, though this can handle odd numbers using byes)
   - Test positioning and visibility before going live

2. **Round-Robin Tournaments:**
   - Consider match count: N players = N×(N-1)/2 matches
   - Use standings display for viewer clarity
   - Adjust points system to match your competition style

3. **Visual Design:**
   - Match colors to your stream theme
   - Use colored stat badges for important information
   - Test visibility at different scales

4. **Performance:**
   - Limit max visible matches for cleaner display
   - Use manual tournament selection for complex setups
   - Clean up ended tournaments regularly

5. **Integration:**
   - Create commands for common actions (advance bracket, show tournament)
   - Use events to trigger automatic announcements
   - Use variables in chat messages for live updates

### Known Limitations

- Maximum visible matches: 5 (for performance and onscreen visibility)
- Maximum visible standings: 10
- Player names should avoid special characters for best compatibility
- Some animations may impact performance on lower-end systems
- Grand Finals may require true final if losers bracket winner wins first match

## Installation

### Script Installation

1. **Download the script files** or build from source following the instructions below
2. **Place the Script in Firebot Scripts Folder:**
   - In Firebot, navigate to **Settings > Scripts > Manage Startup Scripts**
   - Click **Add New Script**
   - In the blue notification bar, click the link labeled **scripts folder**
   - Copy the downloaded script into this folder
   - Hit the **refresh button** beside the **Select script** dropdown
   - Select the tournament system script from the dropdown menu
   - Click **Save**
3. **Available Components:**
   The script adds three effects for use in Firebot:
   - **Advanced Tournament System** - Create new tournaments
   - **Advanced Tournament System Updater** - Manage existing tournaments
   - **Advanced Tournament Backup Manager** - Manage tournament backups
4. **Available Events:**
   The script also adds three events:
   - **Tournament Started** - Triggered when a tournament begins
   - **Tournament Match Updated** - Triggered when a match completes
   - **Tournament Ended** - Triggered when a tournament finishes
5. **Available Variables:**
   Seven replacement variables for dynamic tournament information:
   - `$tournamentWinner` - Get tournament winner
   - `$tournamentStatus` - Get tournament status
   - `$tournamentStage` - Get current stage/round
   - `$tournamentCurrentMatch` - Get current match info
   - `$tournamentPlayerStatus` - Get player status
   - `$tournamentStandings` - Get Round-Robin standings
   - `$tournamentMatches` - Get match information
   - `$findTournamentId` - Search for tournaments

### Building from Source

1. **Clone the repository:**
```bash
git clone https://github.com/MorningStarGG/Firebot-Tournament-System.git
cd Firebot-Tournament-System
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the script:**
```bash
npm run build:prod
```

The compiled script will be in the `dist` folder.

## Technical Support

### Troubleshooting

**Tournament isn't displaying:**
1. Check that the Firebot overlay is loaded in your streaming software
2. Verify the selected overlay instance matches your configuration
3. Ensure the tournament hasn't been automatically stopped
4. Check the position settings
5. Try using "Show Tournament" in the updater effect

**Match isn't progressing:**
1. Verify you selected the correct match number
2. Check that player number is 1 or 2
3. For Round-Robin, ensure draw handling is configured if draws are allowed
4. Review the console for any error messages

**Variables not working:**
1. Ensure tournament ID matches exactly (use `$findTournamentId`)
2. Check that tournament is in active state
3. Verify variable syntax is correct
4. Use manual tournament selection for testing

### Requirements

- **Firebot** 5.64.0 or higher

### Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Join the Firebot Discord server

## License

This script is provided as-is under the GPL-3.0 license. You are free to modify and distribute it according to your needs.

## Acknowledgments

Special thanks to the Firebot community for their support and contributions.

Some of the ideas and code here were inspired by conversations with the late CKY, whose guidance and encouragement were invaluable. May he rest in peace. Thank you for all the love, help, and support—and for pushing me to turn these ideas into scripts for everyone to enjoy on Firebot. I miss you deeply, my friend, and I’m saddened that you never got to see this finally released.

---
**AI Disclaimer:** Parts of this project were created with AI assistance to accelerate development.