import { detectBodies, bodyPartsList } from '../../lib/bodydetection.mjs'
import { drawImageWithOverlay, drawSolidCircle, drawStar } from '../../lib/drawing.mjs'
import { continuosly } from '../../lib/system.mjs'
import { createCameraFeed, facingMode } from '../../lib/camera.mjs'

let canvas;
let ctx;
let flowField;
let flowFieldAnimation;
let noseXPosition = 0;
let noseYPosition = 0;

window.onload = function(){
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    flowField = new FlowFieldEffect(ctx,canvas.width,canvas.height)
    flowField.animate();

}

window.addEventListener('resize', function(){
    this.cancelAnimationFrame(flowFieldAnimation);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    flowField = new FlowFieldEffect(ctx,canvas.width,canvas.height)
    flowField.animate();
});

const nosemouse = {
    x: 0,
    y: 0,
}

function getNoseX(body){
    let nose = body.getBodyPart2D(bodyPartsList.nose);
    noseXPosition = nose.position.x
    noseYPosition = nose.position.y
}

class FlowFieldEffect {
    #ctx;
    #width;
    #height;
    constructor(ctx, width, height){
        this.#ctx = ctx;
        this.#ctx.strokeStyle = 'white';
        this.#ctx.lineWidth= 3;
        this.#width = width;
        this.#height = height;
        this.angle = 0;

    
    

    }
    #draw(x, y) {
        const length = 300;
        this.#ctx.beginPath();
        this.#ctx.moveTo(x,y);
        this.#ctx.lineTo(noseXPosition, noseYPosition);
        this.#ctx.stroke();
        console.log(noseXPosition, noseYPosition);

    }
    animate(){
        this.angle += 0.1;
        //this.#ctx.clearRect(0, 0, this.#width,this.#height);
        this.#draw(this.#width/2, this.#height/2);
       // console.log('animating');
        flowFieldAnimation = requestAnimationFrame(this.animate.bind(this));
        
    }
}

async function run(canvas, status) {
    let latestBody
  
    // create a video element connected to the camera 
    status.innerText = 'Setting up camera feed...'
    const video = await createCameraFeed(canvas.width, canvas.height, facingMode.environment)
  
    const config = {
      video: video,
      multiPose: false,
      sampleRate: 100,
      flipHorizontal: true // true if webcam
    }

    status.innerText = 'Loading model...'
    // start detecting bodies camera-feed a set latestBody to first (and only) body
    detectBodies(config, (e) => latestBody = e.detail.bodies.listOfBodies[0])
  
    // draw video with nose and eyes overlaid onto canvas continuously and output speed of nose
    continuosly(() => {
        if (latestBody)
          getNoseX(latestBody);
    })
  }
  export { run }