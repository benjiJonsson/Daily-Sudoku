# Daily Sudoku Challenge

A web-based Sudoku game that provides daily puzzles with different difficulty levels. 

## Features

- Daily puzzles that reset at UTC midnight
- 5 difficulty levels: Easy, Medium, Hard, Very Hard, and Expert
- Real-time solve timer
- Note-taking functionality
- Mistake tracking (max 2 mistakes allowed)
- Responsive design for mobile and desktop
- Pause/Resume functionality
- Game state persistence

## Tech Stack

- Frontend: HTML, CSS, JavaScript (Vanilla)
- Backend: Python (Flask)
- Database: Redis (for caching puzzles and leaderboards)
- Puzzle Generation: NumPy

## Prerequisites

- Python 3.7+
- Redis server
- pip (Python package manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/daily-sudoku-challenge.git
cd daily-sudoku-challenge
```

2. Install required Python packages:
```bash
pip install flask redis numpy
```

3. Install and start Redis server:
- On Linux/macOS:
  ```bash
  sudo apt-get install redis-server  # For Ubuntu/Debian
  brew install redis                 # For macOS with Homebrew
  ```
- On Windows:
  - Download and install Redis from [Redis for Windows](https://github.com/microsoftarchive/redis/releases)

4. Start Redis server:
```bash
redis-server
```

## Running the Application

1. Start the Flask application:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
daily-sudoku-challenge/
├── app.py              # Flask application and API endpoints
├── Sudoku.py          # Sudoku puzzle generation and validation
├── static/
│   ├── js/
│   │   └── app.js     # Frontend game logic
│   └── styles.css     # CSS styles
├── templates/
│   └── index.html     # Main game page
└── README.md
```

## API Endpoints

- `GET /api/puzzle/<difficulty>` - Get daily puzzle for specified difficulty
- `POST /api/validate/<difficulty>` - Validate solution or get solution
- `POST /api/submit-score` - Submit solve time to leaderboard
- `GET /api/leaderboard/<difficulty>` - Get leaderboard for specified difficulty
- `GET /api/status` - Get current puzzle status and time until next reset

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Next Steps needed
1. Daily leaderboards for each difficulty level
2. Ability to send your completed time to someone else to compete with you
3. Link Grading API to my masters dissertation repo: https://github.com/benjiJonsson/CS5099-Masters-Dissertation

## Acknowledgments
- Inspired by the New York Times Sudoku and sudoku.com
- Puzzle generation algorithm based on backtracking 
