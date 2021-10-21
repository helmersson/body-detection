import { detectBodies, bodyPartsList } from '../../lib/bodydetection.mjs'
import { drawImageWithOverlay, drawSolidCircle, drawStar } from '../../lib/drawing.mjs'
import { continuosly } from '../../lib/system.mjs'
import { createCameraFeed, facingMode } from '../../lib/camera.mjs'

let canvas;
let ctx;
let flowField;
let flowFieldAnimation;

//loads on window load. creates the canvas and gets the context also starts the animations
window.onload = function(){
    canvas = document.getElementById('canvas1');
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    flowField = new FlowFieldEffect(ctx,canvas.width,canvas.height)
    flowField.animate(0);

}
// resizes the canvas at all times to match the window size
window.addEventListener('resize', function(){
    this.cancelAnimationFrame(flowFieldAnimation);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    flowField = new FlowFieldEffect(ctx,canvas.width,canvas.height)
    flowField.animate(0);
});

// x,y coordinates for the nose
const nose = {
    x: 0,
    y: 0,
}

//gets the position of your body part and converts it into x,y coordinates on the canvas
//works the same way as a mouse
function nosePosition(body){
    let nosePos = body.getBodyPart2D(bodyPartsList.rightWrist);
    nose.x = nosePos.position.x
    nose.y = nosePos.position.y
}

//class were we run most of our code. 
class FlowFieldEffect {
    //# means that the variables are private and can not be accessed outside of the class
    #ctx;
    #width;
    #height;
    //Create a constructor that hold most of the values of how we want to paint the canvas.
    constructor(ctx, width, height){
        this.#ctx = ctx;
        this.#ctx.lineWidth = 1;
        this.#width = width;
        this.#height = height;
        this.lastTime = 0;
        this.interval = 1000/60;
        this.timer = 0;
        this.cellSize = 15;
        this.gradient;
        this.#createGradient();
        this.#ctx.strokeStyle = this.gradient;
        this.radius = 0;
        this.vr = 0.03;
    }

    //creates a gradient with multiple colors
    #createGradient(){
        this.gradient = this.#ctx.createLinearGradient(0, 0, this.#width, this.#height);
        this.gradient.addColorStop("0.1", "#ff5c33");
        this.gradient.addColorStop("0.2", "#ff66b3");
        this.gradient.addColorStop("0.4", "#ccccff");
        this.gradient.addColorStop("0.6", "#b3ffff");
        this.gradient.addColorStop("0.8", "#80ff80");
        this.gradient.addColorStop("0.9", "#ffff33");
    }

    //How we draw the lines. We also control the length of the lines depending on the distance to the nose
    #drawLine(angle, x, y) {
        let positionX = x;
        let positionY = y;
        let dx = nose.x - positionX;
        let dy = nose.y - positionY;
        let distance = dx * dx + dy * dy;
        if (distance > 600000) distance = 600000;
        else if (distance < 50000) distance = 50000;
        let length = distance * 0.0001;
        this.#ctx.beginPath();
        this.#ctx.moveTo(x,y);
        this.#ctx.lineTo(x + Math.cos(angle) * length , y + Math.sin(angle) * length);
        this.#ctx.stroke();

    }
    animate(timeStamp){
        const deltaTime = timeStamp - this.lastTime;
        this.lastTime = timeStamp;
        if (this.timer > this.interval) {
            this.#ctx.clearRect(0, 0, this.#width,this.#height);
            this.radius +=this.vr;
            if(this.radius > 5 || this.radius < -5) this.vr *= -1;

            for(let y = 0; y < this.#height; y += this.cellSize) {
                for(let x = 0; x < this.#width; x += this.cellSize){
                    const angle = (Math.cos(x * 0.01) + Math.sin(y * 0.01)) * this.radius;
                    this.#drawLine(angle, x , y);

                }

            }

            this.timer = 0;

        } else {
            this.timer += deltaTime;
        }
        
        flowFieldAnimation = requestAnimationFrame(this.animate.bind(this));
    }
}

async function run(canvas, status) {
    let latestBody

    // create a video element connected to the camera 
    const video = await createCameraFeed(window.innerWidth, window.innerHeight, facingMode.environment)

    const config = {
    video: video,
    multiPose: false,
    sampleRate: 100,
      flipHorizontal: true // true if webcam
    }

    // start detecting bodies camera-feed a set latestBody to first (and only) body
    detectBodies(config, (e) => latestBody = e.detail.bodies.listOfBodies[0])

    // draw video with nose and eyes overlaid onto canvas continuously and output speed of nose
    continuosly(() => {
        if (latestBody)
        nosePosition(latestBody);
    })
}
export { run }