from flask import Flask, jsonify, request, render_template, send_from_directory
from datetime import datetime, timezone, timedelta
import redis
from Sudoku import Sudoku
import numpy as np
import json

app = Flask(__name__)
redis_client = redis.Redis(host='localhost', port=6379, db=0)

DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard', 'Very Hard', 'Expert']

# Serve static files and template
@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files."""
    return send_from_directory('static', path)

# API endpoints
@app.route('/api/puzzle/<difficulty>')
def get_puzzle(difficulty):
    """Get the daily puzzle for specified difficulty."""
    if difficulty not in DIFFICULTY_LEVELS:
        return jsonify({'error': 'Invalid difficulty level'}), 400
        
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        puzzle_key = f"puzzle:{today}:{difficulty}"
        
        # Try to get cached puzzle
        cached_puzzle = redis_client.get(puzzle_key)
        if cached_puzzle:
            puzzle = np.frombuffer(cached_puzzle, dtype=int).reshape(9, 9)
        else:
            # Generate new puzzle with today's seed
            seed = int(datetime.now(timezone.utc).strftime('%Y%m%d'))
            sudoku = Sudoku(seed=seed)
            puzzle, solution = sudoku.generate(difficulty)
            
            # Cache puzzle and solution
            redis_client.set(puzzle_key, puzzle.tobytes())
            redis_client.set(f"{puzzle_key}:solution", solution.tobytes())
            redis_client.expire(puzzle_key, 172800)  # 48 hours
            redis_client.expire(f"{puzzle_key}:solution", 172800)
        
        return jsonify({
            'puzzle': puzzle.tolist(),
            'difficulty': difficulty,
            'date': today
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate/<difficulty>', methods=['POST'])
def validate_solution(difficulty):
    """Validate a submitted solution or return the solution."""
    if difficulty not in DIFFICULTY_LEVELS:
        return jsonify({'error': 'Invalid difficulty level'}), 400
        
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        solution_key = f"puzzle:{today}:{difficulty}:solution"
        solution_bytes = redis_client.get(solution_key)
        
        if not solution_bytes:
            return jsonify({'error': 'Solution not found'}), 404
            
        correct_solution = np.frombuffer(solution_bytes, dtype=int).reshape(9, 9)
        
        # If get_solution flag is set, return the solution
        if request.json.get('get_solution'):
            return jsonify({
                'solution': correct_solution.tolist()
            })
        
        # Otherwise validate the submitted solution
        submitted_solution = np.array(request.json['solution'])
        sudoku = Sudoku()
        is_valid = sudoku.validate_solution(submitted_solution)
        is_correct = np.array_equal(submitted_solution, correct_solution)
        
        return jsonify({
            'valid': is_valid,
            'correct': is_correct
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-score', methods=['POST'])
def submit_score():
    """Submit a solve time to the leaderboard."""
    try:
        data = request.json
        difficulty = data['difficulty']
        solve_time = data['time']
        
        if difficulty not in DIFFICULTY_LEVELS:
            return jsonify({'error': 'Invalid difficulty level'}), 400
            
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        leaderboard_key = f"leaderboard:{today}:{difficulty}"
        
        # Add score to sorted set
        redis_client.zadd(leaderboard_key, {json.dumps({
            'time': solve_time,
            'date': today
        }): solve_time})
        
        # Trim to top 10 scores
        redis_client.zremrangebyrank(leaderboard_key, 10, -1)
        
        # Set expiration for 48 hours
        redis_client.expire(leaderboard_key, 172800)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leaderboard/<difficulty>')
def get_leaderboard(difficulty):
    """Get the leaderboard for specified difficulty."""
    if difficulty not in DIFFICULTY_LEVELS:
        return jsonify({'error': 'Invalid difficulty level'}), 400
        
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        leaderboard_key = f"leaderboard:{today}:{difficulty}"
        
        # Get top 10 scores
        scores_data = redis_client.zrange(leaderboard_key, 0, 9, withscores=True)
        scores = []
        
        for score_json, time in scores_data:
            score_data = json.loads(score_json)
            scores.append({
                'time': int(time),
                'date': score_data['date']
            })
        
        return jsonify({
            'difficulty': difficulty,
            'date': today,
            'scores': scores
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status')
def get_status():
    """Get current puzzle status and time until next reset."""
    now = datetime.now(timezone.utc)
    next_reset = datetime(now.year, now.month, now.day + 1, 
                         tzinfo=timezone.utc)
    
    return jsonify({
        'current_date': now.strftime('%Y-%m-%d'),
        'next_reset': next_reset.isoformat(),
        'seconds_until_reset': int((next_reset - now).total_seconds())
    })

if __name__ == '__main__':
    app.run(debug=True) 