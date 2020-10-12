const detectionType = {
    singleBody: 'singleBody',
    multipleBodies:  'multipleBodies'
}

const bodyParts = {
    nose: "nose",
 	leftEye: "leftEye",
	rightEye: "rightEye",
	leftEar: "leftEar",
	rightEar: "rightEar",
	leftShoulder: "leftShoulder",
	rightShoulder: "rightShoulder",
	leftElbow: "leftElbow",
	rightElbow: "rightElbow",
	leftWrist: "leftWrist",
	rightWrist: "rightWrist",
	leftHip: "leftHip",
	rightHip: "rightHip",
	leftKnee: "leftKnee",
	rightKnee: "rightKnee",
	leftAnkle: "leftAnkle",
	rightAnkle: "rightAnkle"
}

// ----------------- posenet configuration -----------------
const loadConfig = {
  architecture: 'ResNet50',
  outputStride: 32,
  inputResolution: { width: 600, height: 500 },
  quantBytes: 2
}
const poseEstimationConfig  = {
    flipHorizontal: false,
    maxDetections: 2,
    scoreThreshold: 0.6,
    nmsRadius: 20
}
const videoWidth = 600
const videoHeight = 500

// Setup with a posenet, a DOM videoelement, and whether single or multiple bodies should be detected at a time 
// listen to the 'bodiesDetected' event and data about bodies in the video stream are received live
class BodyStream extends EventTarget {
    bodyDetection
    detectionType

    constructor ( posenet, detectionType, videoElement ) {
        super ()
        this.subscribers = new Array()
        this.detectionType = detectionType
        this.bodyDetection = new BodyDetection ( posenet, detectionType, videoElement )
        fromEvent(this.bodyDetection, 'bodiesDetected')
        .pipe(
            map (e => e.detail),
            pairwise())
        .subscribe((result) => {this.onBodiesDetected(result)})
    }

    // Emits moving body data in a friendly shape to any listeners 
    onBodiesDetected (pairOfBodiesList) {
        const bodies = new Bodies( pairOfBodiesList[0], pairOfBodiesList[1], this.detectionType)
        
   
       this.dispatchEvent(new CustomEvent('bodiesDetected', {
                detail: { bodies: bodies }
        })) 
    }

    start (timeout)
    {   
       this.bodyDetection.start (timeout)
    }

    stop ( ) {
        this.bodyDetection.stop ( )

    }

    subscribe (callback) {
        this.subscribers.push(callback)
    }

}
// Represents bodydata of one or more bodies found in one frame

class Bodies {
    prevBodies
    currBodies
    timeLapsed // time lapsed between current and previous detection
    detectionType 

    constructor (prevDetectedBodies, currDetectedBodies, detectionType) {
        this.prevBodies = prevDetectedBodies.bodies
        this.currBodies = currDetectedBodies.bodies
        this.timeLapsed = currDetectedBodies.timestamp - prevDetectedBodies.timestamp
        this.detectionType = detectionType
    }

    getNumOfBodies () {
        return this.currBodies.poses.length
    }
    
    getBodyAt (index) {
        // we assume here that the index corresponds to the same detected body among current and previous bodies
        // this assumption might not always hold  
        const currBody = (index < this.currBodies.length) ? this.currBodies[index] : null  
        const prevBody = (index < this.prevBodies.length) ? this.prevBodies[index] : null  
        return constructBody(currBody, prevBody, this.timeLapsed)        
    }
}

class BodyPart {
    part
    position
    speed // in px/s
    confidenceScore

    constructor (part, position, speed, confidenceScore) {
        this.part = part
        this.position = position
        this.speed = speed
        this.confidenceScore = confidenceScore
    }
}

// an object  class 
class Body {
    bodyParts 
    confidenceScore

    constructor (bodyParts, confidenceScore) {
        this.bodyParts = bodyParts
        this.confidenceScore = confidenceScore
    }

    getBodyPart (bodyPartName) {
        let result = null
        for (const bodyPart of this.bodyParts) {
            if (bodyPart.part === bodyPartName) {
                result = bodyPart
                break
            }
        }
        return result
    }

    getDistanceBetweenBodyParts (first, second) {
        const firstBodyPart = this.getBodyPart(first)
        const secondBodyPart = this.getBodyPart(second)
        if (firstBodyPart && secondBodyPart) {
            return Math.hypot(firstBodyPart.position.x-secondBodyPart.position.x, firstBodyPart.position.y-secondBodyPart.position.y)
        } else {
            return 0
        }
    }
}

// helper function that translate posenet data into an array of (BodyData) a format more friendly to work with
function constructBody (currentBody, previousBody, timeLapsed) {
    const hasPreviousBody = (previousBody != null)
    const bodyParts = []

    // create body parts
    currentBody.keypoints.forEach((curr, i) => {
        let speed =  {
            vector: { x: 0, y: 0 }, 
            absoluteSpeed: 0
        }
        if (hasPreviousBody) {
          const prev = previousBody.keypoints[i]
          // calculates speed
          const distanceX = curr.position.x - prev.position.x // distance along x-axis
          const distanceY = curr.position.y - prev.position.y // distance along y-axis
          const speedX = distanceX / (timeLapsed/1000)
          const speedY = distanceY / (timeLapsed/1000) 
          speed = {
            vector: { x: speedX, y: speedY }, 
            absoluteSpeed: Math.hypot(speedX, speedY)}
        }
        const bodyPart = new BodyPart(curr.part, curr.position, speed, curr.score)
        bodyParts.push(bodyPart)
    }); 
    return new Body ( bodyParts, currentBody.score )
}

// @ts-ignore
const { pipe,fromEvent } = rxjs
// @ts-ignore
const { pairwise, map } = rxjs.operators
 

// a helper class for the BodyStream class
// when started and one or more poses are detected by posenet the 'bodiesDetected' event is fired
class BodyDetection extends EventTarget {
    posenet
    net
    videoElement
    videoIsSetup
    doRun = false
    canRun = false
    timeoutSet = false
    intervalID
    timeoutID
    timeout
    detectionType

    constructor ( posenet, detectionType, videoElement ) {
        super ()
        this.posenet = posenet
        this.detectionType = detectionType
        this.videoElement = videoElement
    }

    async setupVideo () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                'Browser API navigator.mediaDevices.getUserMedia not available');
        }

        const video = document.getElementById('video');
        this.videoElement.width = videoWidth;
        this.videoElement.height = videoHeight;

        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
            facingMode: 'user',
            width: videoWidth,
            height: videoHeight,
            },
        });

        this.videoElement.srcObject = stream;

        return new Promise((resolve) => {
            this.videoElement.onloadedmetadata = () => {
                this.videoIsSetup = true
                resolve(this.videoElement);
            };
        });
        
    }

    async loadNet () {
        this.net = await this.posenet.load(loadConfig)
    }

    async init () {
        if ( !this.net ) 
            await this.loadNet()
        if ( !this.videoIsSetup )
            await this.setupVideo()
    }

    async run () {
        if ( this.canRun && this.doRun )  {
            this.canRun = false // cannot run again until last poses have been retreived

            let estimate
            if (this.detectionType = detectionType.multipleBodies) 
                estimate = await this.net.estimateMultiplePoses(this.videoElement, poseEstimationConfig)
            else
                estimate = await this.net.estimateSinglePose(this.videoElement, poseEstimationConfig)
            const timestamp = Date.now()

            this.dispatchEvent(new CustomEvent('bodiesDetected', {
                detail: { bodies: estimate,
                          timestamp: timestamp  
                        }
            }))
            this.canRun = true // can run
            // set possible timeout
            if (!this.timeoutSet && this.timeout) {
                this.timeoutID = setTimeout( () => {this.stop()}, this.timeout)
                this.timeoutSet = true
            }
         }
    }

    async start (timeout) {
        this.timeout = timeout 
        this.timeoutSet = false

        this.doRun = true
        this.canRun = true

        await this.init ()
        this.intervalID = setInterval(() => {this.run()}, 500)

    }

    stop () {
        this.doRun = false
        clearInterval(this.intervalID)
        clearTimeout(this.timeoutID)
        this.timeoutSet = false
    }
}