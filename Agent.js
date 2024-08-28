class Agent{
    static ANGULAR_VELOCITY_MULTIPLIER = .25;
    static VELOCITY_MULTIPLIER = .75;
    
    position = {x: 0, y: 0};
    lastPosition = {x: 0, y: 0};
    rotation = 0;
    raycastValues = [];
    index = -1;

    //nn outputs
    angularVelocity = 0; //[-1,1]
    velocity = 0; //[-1,1]

    constructor(numOfRays, fov, viewDistance, inputs, hiddenLayers, outputs){
        if(numOfRays == null)
            return; //hacky solution to also allow new Agent();

        this.numOfRays = numOfRays
        this.fov = fov
        this.viewDistance = viewDistance;
        this.inputs = inputs;

        let inputSize = 0;
        let inputLabels = [];
        inputs.forEach(input => {
            switch(input){
                case "raycasts":
                    inputSize += numOfRays;
                    for(let i = 0; i < numOfRays; i++){
                        inputLabels.push(`Ray${i}`)
                    }
                    break;
                case "velocity":
                    inputSize++;
                    inputLabels.push("Velocity");
                    break;
                case "angularVelocity":
                    inputSize++;
                    inputLabels.push("Angular Velocity");
                    break;
                case "xpos":
                    inputSize++;
                    inputLabels.push("X Position");
                    break;
                case "ypos":
                    inputSize++;
                    inputLabels.push("Y Position");
                    break;
                case "random":
                    inputSize++;
                    inputLabels.push("Random");
                    break;
                default:
                    throw new Error(`Invalid NN input type of ${input}`);
            }
        });
        //NN
        this.nn = new NN(inputSize, inputLabels, inputs, hiddenLayers, outputs);
    }

    computeNN(){
        let inputs = [];
        this.nn.inputs.forEach(input => {
            switch(input){
                case "raycasts":
                    this.raycastValues.forEach(value => inputs.push(value / this.viewDistance));
                    break;
                case "velocity":
                    inputs.push(this.velocity);
                    break;
                case "angularVelocity":
                    inputs.push(this.angularVelocity)
                    break;
                case "xpos":
                    inputs.push(this.position.x / world.width);
                    break;
                case "ypos":
                    inputs.push(this.position.y / world.height);
                    break;
                case "random":
                    inputs.push(Math.random());
                    break;
                default:
                    throw new Error(`Invalid NN input type of ${input}`);
            }
        });

        let results = this.nn.getResult(inputs);

        if(this.nn.outputs.length != results.length){
            throw new Error(`Invalid # of outputs. Expected: ${this.nn.outputs.length}, Received: ${results.length}`);
        }

        this.nn.outputs.forEach((output, i) => {
            switch(output){
                case "velocity":
                    this.velocity = results[i];
                    break;
                case "angularVelocity":
                    this.angularVelocity = results[i];
                    break;
                default:
                    throw new Error(`Invalid NN output type of ${output}`);
            }
        });
    }

    reproduce(){
        let clone = new Agent();
        clone.numOfRays = this.numOfRays
        clone.fov = this.fov
        clone.viewDistance = this.viewDistance;
        clone.inputs = JSON.parse(JSON.stringify(this.inputs));
        clone.nn = this.nn.reproduce();

        return clone; //TODO change this to make a new object in the future, need for non asexual reproduction
    }

    mutate(){
        //mutate agent attributes

        //mutate brain attributes
        this.nn.mutate()
    }

    move(){
        this.lastPosition.x = this.position.x;
        this.lastPosition.y = this.position.y;

        this.rotation += this.angularVelocity * Agent.ANGULAR_VELOCITY_MULTIPLIER;
        this.rotation %= 2*Math.PI;

        this.position.x += Math.cos(this.rotation) * this.velocity * Agent.VELOCITY_MULTIPLIER;
        this.position.y += Math.sin(this.rotation) * this.velocity * Agent.VELOCITY_MULTIPLIER;
    }
}