
const TAU = Math.PI * 2;
const BALLS_COUNT = 1000;
const BALL_RADIUS = 5;
const CURSOR_RADIUS = 50;
const COLORS = [
    "#d69600",
    "#c90093",
];
const QUADRANT_SIZE = 50;
const MAX_ACCELERATION = 0;
const MAX_VELOCITY = 1;
const BALL_REPULSION_CONSTANT = 10;
const CURSOR_REPULSION_CONSTANT = 100;
const CONVERGENCE_FACTOR = 0.98;
const SHOULD_DRAW_QUADRANTS = false;
const SHOULD_WALLS_REPEL = true;

class Ball {
    constructor (x, y, kind) {
        this.pos = new Vector(x, y);
        this.kind = kind;
        this.quadrantIndex = -1;
        this.vel = new Vector();
        this.acc = new Vector();
    }
}

class App {

    constructor () {
        this.canvas = document.createElement("canvas");
        this.width = this.canvas.width = 1050;
        this.height = this.canvas.height = 800;
        this.ctx = this.canvas.getContext("2d");
        document.body.appendChild(this.canvas);

        this.balls = Array.from(Array(BALLS_COUNT),
            () => new Ball(Math.random() * this.width, Math.random() * this.height,
                Math.floor(Math.random() * COLORS.length)));

        this.QUADRANT_COLS = Math.ceil(this.width / QUADRANT_SIZE);
        this.QUADRANT_ROWS = Math.ceil(this.height / QUADRANT_SIZE);
        this.quadrants = Array.from(Array(this.QUADRANT_COLS * this.QUADRANT_ROWS), () => new Set());
        this.aux = new Vector();

        this.cursor = new Vector();
        this.isCursorActive = false;

        for (const ball of this.balls) {
            ball.quadrantIndex = this.getQuadrantIndexByCoordinate(ball.pos.x, ball.pos.y);
            this.quadrants[ball.quadrantIndex].add(ball);
        }

        this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
        this.canvas.addEventListener("mouseout", this.onMouseOut.bind(this));

        this.updateFn = this.update.bind(this);
        requestAnimationFrame(this.updateFn);
    }

    onMouseMove(event) {
        this.cursor.set(event.offsetX, event.offsetY);
        this.isCursorActive = true;
    }

    onMouseOut(event) {
        this.isCursorActive = false;
    }

    getQuadrantIndexByCoordinate(x, y) {
        const col = Math.floor(x / QUADRANT_SIZE);
        const row = Math.floor(y / QUADRANT_SIZE);
        return row * this.QUADRANT_COLS + col;
    }

    update(t) {
        const c = this.ctx;
        c.fillStyle = "#000";
        c.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // update balls acceleration
        for (let qi = 0; qi < this.quadrants.length; qi++) {
            const quadrantIndexes = [
                qi,                           // self
                qi - this.QUADRANT_COLS,      // N
                qi - this.QUADRANT_COLS + 1,  // NE
                1,                            // E
                qi + this.QUADRANT_COLS + 1,  // SE
                qi + this.QUADRANT_COLS,      // S
                qi + this.QUADRANT_COLS - 1,  // SW
                -1,                           // W
                qi - this.QUADRANT_COLS - 1,  // NW
            ];

            // for each ball in that quadrant
            for (const ball of this.quadrants[qi]) {
                ball.acc.clear();
                // for each neighbor quadrant, calculate resulting repulsion
                for (const qi of quadrantIndexes) {
                    if (qi < 0 || qi >= this.quadrants.length) {
                        continue;  // invalid quadrant index
                    }
                    // for each ball in that neighbor quadrant
                    for (const neighbor of this.quadrants[qi]) {
                        if (neighbor === ball) continue;  // self

                        this.accumulateForce(ball, neighbor.pos, BALL_REPULSION_CONSTANT);
                    }
                }

                if (SHOULD_WALLS_REPEL) {
                    // repulsion coming from top border
                    this.aux.set(ball.pos.x, 0);
                    this.accumulateForce(ball, this.aux, BALL_REPULSION_CONSTANT);
                    // repulsion coming from right border
                    this.aux.set(this.width, ball.pos.y);
                    this.accumulateForce(ball, this.aux, BALL_REPULSION_CONSTANT);
                    // repulsion coming from bottom border
                    this.aux.set(ball.pos.x, this.height);
                    this.accumulateForce(ball, this.aux, BALL_REPULSION_CONSTANT);
                    // repulsion coming from left border
                    this.aux.set(0, ball.pos.y);
                    this.accumulateForce(ball, this.aux, BALL_REPULSION_CONSTANT);
                }

                // repulsion coming from cursor
                if (this.isCursorActive) {
                    this.accumulateForce(ball, this.cursor, CURSOR_REPULSION_CONSTANT);
                }

                if (MAX_ACCELERATION) {
                    const accMagnitude = ball.acc.length;
                    if (accMagnitude > MAX_ACCELERATION) {
                        ball.acc.normalize().scale(MAX_ACCELERATION);  // cap acceleration
                    }
                }

                ball.vel.add(ball.acc);

                if (CONVERGENCE_FACTOR) {
                    // simply steal energy from the velocity vector at each step
                    ball.vel.scale(CONVERGENCE_FACTOR);
                }

                // impose maximum velocity so system does not go unstable
                const velMagnitude = ball.vel.length;
                if (velMagnitude > MAX_VELOCITY) {
                    ball.vel.normalize().scale(MAX_VELOCITY);  // cap velocity
                }
            }
        }

        // update balls position and quadrant *after all interactions have been calculated*
        for (const ball of this.balls) {
            ball.pos.add(ball.vel);

            if (this.isCursorActive) {
                // do not let balls stay within cursor radius
                if (this.aux.set(ball.pos).subtract(this.cursor).length < CURSOR_RADIUS) {
                    this.aux.normalize().scale(CURSOR_RADIUS + BALL_RADIUS).add(this.cursor);
                    ball.pos.set(this.aux);
                }
            }

            if (ball.pos.x <= 0) ball.pos.x = 1;
            if (ball.pos.x >= this.width) ball.pos.x = this.width - 1;
            if (ball.pos.y <= 0) ball.pos.y = 1;
            if (ball.pos.y >= this.height) ball.pos.y = this.height - 1;

            const currentQuadrantIndex = this.getQuadrantIndexByCoordinate(ball.pos.x, ball.pos.y);
            if (ball.quadrantIndex !== currentQuadrantIndex) {
                this.quadrants[ball.quadrantIndex].delete(ball);
                this.quadrants[currentQuadrantIndex].add(ball);
                ball.quadrantIndex = currentQuadrantIndex;
            }
        }

        // draw quadrants
        if (SHOULD_DRAW_QUADRANTS) {
            c.strokeStyle = "#666";
            for (let y = 0; y < this.height; y += QUADRANT_SIZE) {
                c.beginPath();
                c.moveTo(0, y);
                c.lineTo(this.width, y);
                c.stroke();
            }
            for (let x = 0; x < this.width; x += QUADRANT_SIZE) {
                c.beginPath();
                c.moveTo(x, 0);
                c.lineTo(x, this.height);
                c.stroke();
            }
        }

        // draw balls
        for (const ball of this.balls) {
            c.fillStyle = COLORS[ball.kind];
            c.beginPath();
            c.arc(ball.pos.x, ball.pos.y, BALL_RADIUS, 0, TAU);
            c.fill();
        }

        if (this.isCursorActive) {
            c.fillStyle = "#8f5fff";
            c.beginPath();
            c.arc(this.cursor.x, this.cursor.y, CURSOR_RADIUS, 0, TAU);
            c.fill();
        }

        requestAnimationFrame(this.updateFn);
    }

    accumulateForce(ball, neighborPos, repulsiveForceConstant) {
        Vector.subtract(ball.pos, neighborPos, this.aux);
        const magnitude = Math.max(1, this.aux.length);
        this.aux.normalize().scale(repulsiveForceConstant / (magnitude ** 2));
        ball.acc.add(this.aux);
    }
}

new App();
