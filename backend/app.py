import random, os
from flask_cors import CORS
from flask import Flask, request, jsonify

app = Flask(__name__)
CORS(app)

SHAPES = {
    'I': {'m': [[1, 1, 1, 1]], 'c': '#00f0f0'},
    'O': {'m': [[1, 1], [1, 1]], 'c': '#f0f000'},
    'J': {'m': [[1, 0, 0], [1, 1, 1]], 'c': '#0000f0'},
    'L': {'m': [[0, 0, 1], [1, 1, 1]], 'c': '#f0a000'},
    'S': {'m': [[0, 1, 1], [1, 1, 0]], 'c': '#00f000'},
    'T': {'m': [[0, 1, 0], [1, 1, 1]], 'c': '#a000f0'},
    'Z': {'m': [[1, 1, 0], [0, 1, 1]], 'c': '#f00000'}
}

class Tetris:
    def __init__(self):
        self.hs_file = os.path.join(os.path.dirname(__file__), "highscore.txt")
        self.high_score = self.load_hs()
        self.reset()

    def load_hs(self):
        if os.path.exists(self.hs_file):
            try:
                with open(self.hs_file, "r") as f:
                    content = f.read().strip()
                    return int(content) if content else 0
            except: return 0
        return 0

    def save_hs(self):
        with open(self.hs_file, "w") as f:
            f.write(str(self.high_score))

    def reset(self):
        self.board = [[None]*10 for _ in range(20)]
        self.score, self.level, self.lines = 0, 1, 0
        self.paused = self.game_over = False
        self.next_piece, self.hold_piece = self.new_p(), None
        self.can_hold = True
        self.spawn()

    def new_p(self):
        s = random.choice(list(SHAPES.keys()))
        return {'shape': s, 'matrix': SHAPES[s]['m'], 'color': SHAPES[s]['c']}

    def spawn(self):
        self.active = self.next_piece
        self.next_piece = self.new_p()
        self.active['x'], self.active['y'] = 3, 0
        if self.check_col(self.active['matrix'], 3, 0): self.game_over = True
        self.can_hold = True

    def check_col(self, m, ox, oy):
        for y, row in enumerate(m):
            for x, v in enumerate(row):
                if v:
                    tx, ty = ox + x, oy + y
                    if tx < 0 or tx >= 10 or ty >= 20 or (ty >= 0 and self.board[ty][tx]):
                        return True
        return False

    def move(self, dx, dy):
        if not self.check_col(self.active['matrix'], self.active['x']+dx, self.active['y']+dy):
            self.active['x'] += dx
            self.active['y'] += dy
            return True
        if dy > 0: self.freeze()
        return False

    def rotate(self):
        m = self.active['matrix']
        new_m = [list(row) for row in zip(*m[::-1])]
        if not self.check_col(new_m, self.active['x'], self.active['y']):
            self.active['matrix'] = new_m

    def get_ghost_y(self):
        gy = self.active['y']
        while not self.check_col(self.active['matrix'], self.active['x'], gy + 1): gy += 1
        return gy

    def freeze(self):
        for y, row in enumerate(self.active['matrix']):
            for x, v in enumerate(row):
                if v: self.board[self.active['y']+y][self.active['x']+x] = self.active['color']
        self.clear_lines()
        self.spawn()

    def clear_lines(self):
        lines = [i for i, row in enumerate(self.board) if all(row)]
        for i in lines:
            del self.board[i]
            self.board.insert(0, [None]*10)
        self.lines += len(lines)
        self.score += [0, 100, 300, 500, 800][len(lines)] * self.level
        if self.score > self.high_score:
            self.high_score = self.score
            self.save_hs()
        self.level = (self.lines // 10) + 1

    def hold(self):
        if not self.can_hold: return
        curr_shape = self.active['shape']
        if self.hold_piece:
            self.active = self.hold_piece
            self.hold_piece = {'shape': curr_shape, 'matrix': SHAPES[curr_shape]['m'], 'color': SHAPES[curr_shape]['c']}
            self.active['x'], self.active['y'] = 3, 0
        else:
            self.hold_piece = {'shape': curr_shape, 'matrix': SHAPES[curr_shape]['m'], 'color': SHAPES[curr_shape]['c']}
            self.spawn()
        self.can_hold = False

    def get_state(self):
        return {
            'board': self.board, 'active': self.active, 'next': self.next_piece,
            'hold': self.hold_piece, 'score': self.score, 'hs': self.high_score,
            'level': self.level, 'paused': self.paused, 'game_over': self.game_over, 
            'ghost_y': self.get_ghost_y()
        }

game = Tetris()

@app.route('/state', methods=['POST'])
def handle_state():
    cmd = request.json.get('cmd')
    if not game.game_over and not game.paused:
        if cmd == 'left': game.move(-1, 0)
        elif cmd == 'right': game.move(1, 0)
        elif cmd == 'down': game.move(0, 1)
        elif cmd == 'rotate': game.rotate()
        elif cmd == 'tick': game.move(0, 1)
        elif cmd == 'hold': game.hold()
        elif cmd == 'hard_drop': 
            while game.move(0, 1): pass
    
    if cmd == 'pause': game.paused = not game.paused
    if cmd == 'reset': game.reset()
    
    return jsonify(game.get_state())

if __name__ == '__main__':
    app.run(port=5000, debug=True)