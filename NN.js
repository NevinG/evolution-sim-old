class Node {
    constructor(weightsDim){
        if(weightsDim == null)
            return; //hacky solution to allow new Node();

        this.weights = [];
        this.bias = .5 - Math.random();
        this.value = 0;

        for(let i = 0; i < weightsDim; i++){
            this.weights.push(.5 - Math.random());
        }
    }

    computeValue(input, activation){
        if(input.length != this.weights.length){
            throw new Error(`MISMATCH DIMENSIONS: ${input.length} x ${this.weights.length}! Should be NxN`);
        }

        let result = this.bias;
        for(let i = 0; i < input.length; i++){
            result += input[i] * this.weights[i];
        }

        switch(activation){
            case "sigmoid": 
                this.value = 1 / (1 + Math.pow(Math.E, -result));
                break;
            case "tanh":
                this.value = Math.tanh(result);
                break;
            case "relu":
                this.value = Math.max(0, result);
                break;
            default:
                throw new Error(`activation function ${activation} does not exist`);
        }
        return this.value;
    }
}

class Layer {
    constructor(n, weightsDim){
        if(n == null)
            return; //hacky solution to allow new Layer()
        this.nodes = [];
        for(let i = 0; i < n; i++){
            this.nodes.push(new Node(weightsDim));
        }
    }
}

class NN{
    static mutateRate = .1; //TODO change this to be configurate, rn temp hardcoded

    inputSize = null;
    layers = [];
    lastInput = [];

    constructor(inputSize, inputLabels, inputs, hiddenLayers, outputs){
        if(inputSize == null)
            return; //hacky solution to allow new NN();
        this.inputs = inputs;
        this.inputLabels = inputLabels;
        this.outputs = outputs;

        this.addLayer(inputSize);
        hiddenLayers.forEach(layer => this.addLayer(layer));
        this.addLayer(outputs.length);
    }

    addLayer(n){
        if(this.inputSize == null){
            this.inputSize = n;
        }else{
            this.layers.push(new Layer(n, this.layers.length == 0 ? this.inputSize : this.layers[this.layers.length - 1].nodes.length));
        }
    }

    getResult(input){
        if(input.length != this.layers[0].nodes[0].weights.length){
            throw new Error(`Input had ${input.length} values. It should have ${this.layers[0].nodes[0].weights.length} values`);
        }

        this.lastInput = input;
        //do hidden layer values
        let lastLayerValues = input;
        for(let i = 0; i < this.layers.length; i++){
            let newLayerValues = [];
            for(let j = 0; j < this.layers[i].nodes.length; j++){
                newLayerValues.push(this.layers[i].nodes[j].computeValue(lastLayerValues, i + 1 == this.layers.length ? "tanh": "tanh"));
            }
            lastLayerValues = newLayerValues;
        }

        return lastLayerValues;
    }

    reproduce(){
        let clone = new NN();
        clone.inputs = this.inputs;
        clone.inputLabels = this.inputLabels;
        clone.outputs = this.outputs;
        clone.inputSize = this.inputSize;

        let layers = [];
        this.layers.forEach(layer => {
            let newLayer = new Layer();
            let newNodes = [];
            layer.nodes.forEach(node => {
                let newNode = new Node();
                newNode.weights = JSON.parse(JSON.stringify(node.weights));
                newNode.bias = node.bias;
                newNodes.push(newNode);
            });
            newLayer.nodes = newNodes;
            layers.push(newLayer);
        });
        clone.layers = layers;

        return clone;
    }

    mutate(){
        for(let i = 0; i < this.layers.length; i++){
            for(let j = 0; j < this.layers[i].nodes.length; j++){
                //mutate weights
                for(let k = 0; k < this.layers[i].nodes[j].weights.length; k++){
                    if(Math.random() < NN.mutateRate){ //random mutate chance for this rate
                        //increase or decrease by random number in [-1,1];
                        this.layers[i].nodes[j].weights[k] += (Math.random() -.5); //TODO make this mutation amount customizable
                    }
                }
                //mutate bias
                if(Math.random() < NN.mutateRate){
                    this.layers[i].nodes[j].bias += (Math.random() -.5) * 2;
                }
            }
        }
    }
}